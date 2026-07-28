mod app;
mod db;
mod error;
mod middleware;
mod models;
mod routes;
mod services;

use std::env;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing/logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    // Load environment variables from .env file (for local development)
    dotenvy::dotenv().ok();

    // Get database URL from environment
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    tracing::info!("Initializing database connection pool...");

    // Initialize database connection pool
    let pool = db::init_pool(&database_url)
        .await
        .expect("Failed to create database pool");

    tracing::info!("Running database migrations...");

    // Run migrations using migrations-v2 (single-statement files for DSQL compatibility)
    // On DSQL: May fail on first deploy - run manually with: ./apply-migrations.sh --dsql-east
    // On success: No-op if migrations already applied, applies any new ones
    // On failure: Warns but continues - assumes migrations were applied manually
    match db::run_migrations(&pool).await {
        Ok(_) => tracing::info!("✓ Migrations completed successfully"),
        Err(e) => {
            tracing::warn!("⚠ Migration warning: {}. Continuing startup...", e);
            tracing::warn!("  Run migrations manually: ./apply-migrations.sh --dsql-east");
        }
    }

    // Seed allowed emails from env var
    routes::allowed_emails::seed_allowed_emails(&pool).await;

    // Require at least one bootstrap user. The allowlist fails closed, so an
    // empty allowlist would lock everyone out. Refuse to start and explain how
    // to fix it rather than come up in an unusable (or, historically, fail-open)
    // state. Note we check the table, not the env var: a prior deploy may have
    // already populated it, in which case ALLOWED_EMAILS is not required again.
    match routes::allowed_emails::count_allowed_emails(&pool).await {
        Ok(0) => {
            print_bootstrap_help();
            return Err(anyhow::anyhow!("No bootstrap user configured"));
        }
        Ok(n) => tracing::info!("Allowlist configured with {} email(s)", n),
        Err(e) => {
            return Err(anyhow::Error::new(e).context("Failed to verify allowlist configuration"));
        }
    }

    tracing::info!("Creating Axum application...");

    // Create the Axum application
    let app = app::create_app(pool).await?;

    // Check if we're running in AWS Lambda or locally
    if env::var("AWS_LAMBDA_FUNCTION_NAME").is_ok() {
        tracing::info!("Running in AWS Lambda environment");

        // Run in Lambda using lambda_http
        // TODO: Fix error type conversion for lambda_http
        match lambda_http::run(app).await {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("Lambda error: {:?}", e);
                Err(anyhow::anyhow!("Lambda runtime error"))
            }
        }
    } else {
        tracing::info!("Running in local development mode");

        // Run locally with Tokio
        let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;

        tracing::info!("Server listening on http://0.0.0.0:3000");

        axum::serve(listener, app).await?;
        Ok(())
    }
}

/// Print operator instructions when no bootstrap user is configured.
fn print_bootstrap_help() {
    tracing::error!("No bootstrap user configured — refusing to start.");
    eprintln!(
        "\n\
        ============================================================\n\
         STARTUP ERROR: No bootstrap user configured\n\
        ============================================================\n\
        The email allowlist is empty. For security, logins fail closed,\n\
        so no one would be able to sign in.\n\
        \n\
        Set the ALLOWED_EMAILS environment variable to a comma-separated\n\
        list of Google account emails permitted to log in, then restart:\n\
        \n\
            ALLOWED_EMAILS=\"you@example.com,teammate@example.com\"\n\
        \n\
        These are seeded into the allowed_emails table on startup. Once at\n\
        least one email exists (via the env var or already in the table),\n\
        this check passes and the variable is no longer required on later\n\
        startups.\n\
        ============================================================\n"
    );
}
