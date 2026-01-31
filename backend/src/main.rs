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

    // Run migrations (includes conditional logic for PostgreSQL vs DSQL)
    // Note: For DSQL, migrations may fail due to CREATE INDEX syntax differences
    // In production, run migrations manually with ASYNC syntax first
    match db::run_migrations(&pool).await {
        Ok(_) => tracing::info!("✓ Migrations completed successfully"),
        Err(e) => {
            tracing::warn!("⚠ Migration warning: {}. Continuing startup...", e);
            tracing::warn!("  For DSQL: Ensure migrations were run manually with CREATE INDEX ASYNC syntax");
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
