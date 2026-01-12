use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;

/// Initialize database connection pool
/// Compatible with both PostgreSQL and Aurora DSQL
pub async fn init_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await
}

/// Run database migrations
/// All migrations are DSQL-compatible (Aurora DSQL is the primary deployment target)
pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
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
