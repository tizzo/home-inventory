use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions, PgSslMode},
    PgPool, ConnectOptions,
};
use std::time::Duration;
use aws_sdk_dsql::auth_token::{Config, AuthTokenGenerator};
use aws_config::{BehaviorVersion, Region};

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
        let url = url::Url::parse(database_url)
            .map_err(|e| sqlx::Error::Configuration(format!("Invalid DATABASE_URL: {}", e).into()))?;

        let host = url.host_str()
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
            .map_err(|e| sqlx::Error::Configuration(format!("Failed to generate auth token: {}", e).into()))?;

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

/// Run database migrations
/// All migrations are DSQL-compatible (Aurora DSQL is the primary deployment target)
/// Note: Locking is disabled because DSQL doesn't support pg_advisory_lock
pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations")
        .set_locking(false)
        .run(pool)
        .await
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
