use aws_config::{BehaviorVersion, Region};
use aws_sdk_dsql::auth_token::{AuthTokenGenerator, Config};
use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions, PgSslMode},
    ConnectOptions, PgPool,
};
use std::time::Duration;

/// Initialize database connection pool
/// Compatible with both PostgreSQL (local) and Aurora DSQL (Lambda with IAM auth)
pub async fn init_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    // Debug: Log environment variable check
    let lambda_env = std::env::var("AWS_LAMBDA_FUNCTION_NAME");
    tracing::info!("AWS_LAMBDA_FUNCTION_NAME check: {:?}", lambda_env);

    // Check if we're running in Lambda (AWS environment with IAM role)
    if lambda_env.is_ok() {
        tracing::info!("✓ Running in Lambda - using IAM authentication for DSQL");

        // Parse database URL to extract connection parameters
        // Format: postgresql://admin@host:port/database?sslmode=require
        let url = url::Url::parse(database_url).map_err(|e| {
            sqlx::Error::Configuration(format!("Invalid DATABASE_URL: {}", e).into())
        })?;

        let host = url
            .host_str()
            .ok_or_else(|| sqlx::Error::Configuration("Missing host in DATABASE_URL".into()))?;
        let port = url.port().unwrap_or(5432);
        let username = url.username();
        let database = url.path().trim_start_matches('/');
        let region = std::env::var("AWS_REGION").unwrap_or_else(|_| "us-east-1".to_string());

        tracing::info!("Generating IAM auth token for DSQL cluster: {}", host);

        // Load AWS config from environment (uses Lambda execution role)
        let sdk_config = aws_config::load_defaults(BehaviorVersion::latest()).await;

        // Create DSQL auth token generator config
        let dsql_config = Config::builder()
            .hostname(host)
            .region(Region::new(region))
            .build()
            .unwrap();

        let signer = AuthTokenGenerator::new(dsql_config);

        // Generate authentication token
        let auth_token = signer
            .db_connect_admin_auth_token(&sdk_config)
            .await
            .map_err(|e| {
                sqlx::Error::Configuration(format!("Failed to generate auth token: {}", e).into())
            })?;

        // Convert AuthToken to String
        let password_token = auth_token.to_string();

        tracing::info!("IAM auth token generated successfully");

        // Create connection options with IAM token
        let mut connection_options = PgConnectOptions::new()
            .host(host)
            .port(port)
            .database(database)
            .username(username)
            .password(password_token.as_str())
            .ssl_mode(PgSslMode::VerifyFull);

        // Disable statement logging for cleaner Lambda logs
        connection_options = connection_options.disable_statement_logging();

        // Create connection pool
        PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(5))
            .connect_with(connection_options)
            .await
    } else {
        tracing::info!("Running locally - using password-based authentication");

        // Local development - use standard connection string
        PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(5))
            .connect(database_url)
            .await
    }
}

/// Run database migrations.
///
/// Uses migrations-v2 which has single-statement files for DSQL compatibility.
/// Each file contains exactly ONE SQL statement, making it work with both:
/// - Local PostgreSQL (via sqlx::migrate!)
/// - AWS Aurora DSQL (single statement per transaction requirement)
///
/// Note: Locking is disabled because DSQL doesn't support pg_advisory_lock.
pub async fn run_migrations(pool: &PgPool) -> anyhow::Result<()> {
    // Clean up stale migration entries from the old migrations/ directory.
    // The _sqlx_migrations table may contain entries (e.g. 20240101000000) that
    // don't exist in migrations-v2/. sqlx aborts if it finds applied migrations
    // missing from the resolved set, so we remove them first.
    let known_versions: Vec<i64> = sqlx::migrate!("./migrations-v2")
        .migrations
        .iter()
        .map(|m| m.version)
        .collect();

    match sqlx::query("DELETE FROM _sqlx_migrations WHERE version != ALL($1)")
        .bind(&known_versions)
        .execute(pool)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                tracing::info!(
                    "Cleaned {} stale migration entries from _sqlx_migrations",
                    result.rows_affected()
                );
            }
        }
        Err(e) => {
            tracing::warn!("Failed to clean stale migration entries: {}", e);
        }
    }

    // Try sqlx's built-in migrate runner first (works on local PostgreSQL).
    // On DSQL this fails with "ddl and dml not supported in same transaction"
    // because sqlx mixes CREATE TABLE with INSERT into _sqlx_migrations.
    let mut migrator = sqlx::migrate!("./migrations-v2");
    match migrator.set_locking(false).run(pool).await {
        Ok(()) => return Ok(()),
        Err(e) => {
            let err_str = e.to_string();
            if !err_str.contains("ddl and dml") && !err_str.contains("same transaction") {
                return Err(e.into());
            }
            tracing::warn!(
                "sqlx migrate failed on DSQL ({}), falling back to manual runner",
                err_str
            );
        }
    }

    // Fallback: run each migration as separate statements so DDL and DML
    // never share a DSQL implicit transaction.
    run_migrations_manually(pool, &migrator).await
}

async fn run_migrations_manually(
    pool: &PgPool,
    migrator: &sqlx::migrate::Migrator,
) -> anyhow::Result<()> {
    use sqlx::Row;

    for migration in migrator.migrations.iter() {
        let applied: bool =
            sqlx::query("SELECT EXISTS(SELECT 1 FROM _sqlx_migrations WHERE version = $1)")
                .bind(migration.version)
                .fetch_one(pool)
                .await
                .map(|row| row.get::<bool, _>(0))
                .unwrap_or(false);

        if applied {
            continue;
        }

        tracing::info!(
            "Applying migration {}: {}",
            migration.version,
            migration.description
        );

        let sql: &str = &migration.sql;

        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let err_str = e.to_string();
                // Treat "already exists" as success — the object was created by
                // a previous manual migration run that didn't record in _sqlx_migrations.
                if err_str.contains("already exists") {
                    tracing::info!(
                        "Migration {}: object already exists, recording as applied",
                        migration.version
                    );
                } else {
                    tracing::error!("Migration {} failed: {:?}", migration.version, e);
                    return Err(anyhow::anyhow!(
                        "migration {} failed: {}",
                        migration.version,
                        e
                    ));
                }
            }
        }

        // Record as applied (separate statement = separate DSQL implicit tx)
        let checksum: &[u8] = &migration.checksum;
        sqlx::query(
            "INSERT INTO _sqlx_migrations (version, description, installed_on, success, checksum, execution_time) VALUES ($1, $2, NOW(), TRUE, $3, 0) ON CONFLICT (version) DO NOTHING",
        )
        .bind(migration.version)
        .bind(migration.description.as_ref())
        .bind(checksum)
        .execute(pool)
        .await?;

        tracing::info!("✓ Migration {} applied", migration.version);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Only run when DATABASE_URL is set
    async fn test_database_connection() {
        let database_url =
            std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");

        let pool = init_pool(&database_url).await;
        assert!(pool.is_ok(), "Failed to connect to database");

        let pool = pool.unwrap();

        // Test a simple query
        let result: Result<(i32,), sqlx::Error> = sqlx::query_as("SELECT 1").fetch_one(&pool).await;

        assert!(result.is_ok(), "Failed to execute test query");
        assert_eq!(result.unwrap().0, 1);
    }
}
