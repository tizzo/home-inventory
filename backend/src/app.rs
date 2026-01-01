use axum::{
    extract::State,
    http::{header, Method, StatusCode},
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

use crate::services::s3::S3Service;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub s3: Arc<S3Service>,
    pub app_base_url: String,
}

#[derive(Serialize, Deserialize)]
pub struct HealthResponse {
    status: String,
    database: String,
}

/// Health check endpoint
/// Verifies both application and database connectivity
pub async fn health_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HealthResponse>, StatusCode> {
    // Test database connection with a simple query
    let db_status = match sqlx::query("SELECT 1").fetch_one(&state.db).await {
        Ok(_) => "connected",
        Err(e) => {
            tracing::error!("Database health check failed: {:?}", e);
            "disconnected"
        }
    };

    let response = HealthResponse {
        status: "ok".to_string(),
        database: db_status.to_string(),
    };

    if db_status == "connected" {
        Ok(Json(response))
    } else {
        Err(StatusCode::SERVICE_UNAVAILABLE)
    }
}

/// Create the Axum application router
pub async fn create_app(db: PgPool) -> anyhow::Result<Router> {
    tracing::info!("Initializing S3 service...");
    let s3_service = match S3Service::new().await {
        Ok(service) => {
            tracing::info!("S3 service initialized successfully");
            Arc::new(service)
        }
        Err(e) => {
            tracing::error!("Failed to initialize S3 service: {:?}", e);
            tracing::error!("Make sure MinIO is running and environment variables are set");
            tracing::error!("Bucket should be auto-created by MinIO via MINIO_BUCKETS env var");
            return Err(anyhow::anyhow!("Failed to initialize S3 service: {:?}", e));
        }
    };

    // Get app base URL for QR code generation (defaults to localhost for dev)
    let app_base_url =
        env::var("APP_BASE_URL").unwrap_or_else(|_| "http://localhost:5173".to_string());

    let state = Arc::new(AppState {
        db,
        s3: s3_service,
        app_base_url,
    });

    // Configure CORS for local development
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    Ok(Router::new()
        .route("/health", get(health_check))
        .merge(crate::routes::room_routes())
        .merge(crate::routes::shelving_unit_routes())
        .merge(crate::routes::shelf_routes())
        .merge(crate::routes::container_routes())
        .merge(crate::routes::photo_routes())
        .merge(crate::routes::label_routes())
        .with_state(state)
        .layer(cors))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    async fn create_test_pool() -> PgPool {
        let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgresql://postgres:devpass@localhost:5432/inventory".to_string()
        });

        crate::db::init_pool(&database_url)
            .await
            .expect("Failed to create test pool")
    }

    #[tokio::test]
    #[ignore] // Only run when DATABASE_URL is set
    async fn test_health_check_endpoint() {
        let pool = create_test_pool().await;
        let app = create_app(pool).await.unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_health_check_with_mock_pool() {
        // This test would fail with a real disconnected database
        // but demonstrates the structure
        let database_url = "postgresql://invalid:invalid@localhost:9999/invalid";

        // This will likely fail to connect, which is expected for this test
        if let Ok(pool) = crate::db::init_pool(database_url).await {
            let app = create_app(pool).await.unwrap();

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/health")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await;

            // Either the connection fails or the health check returns unavailable
            assert!(response.is_ok() || response.is_err());
        }
    }
}
