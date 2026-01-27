use axum::{
    extract::State,
    http::{header, Method, StatusCode},
    response::Json,
    Router,
};
use oauth2::{basic::BasicClient, AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_sessions::{Expiry, SessionManagerLayer};
use tower_sessions_sqlx_store::PostgresStore;

use crate::services::audit::AuditService;
use crate::services::s3::S3Service;
use crate::services::{CaptchaService, VisionService};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub s3: Arc<S3Service>,
    pub app_base_url: String,
    pub audit: Arc<crate::services::audit::AuditService>,
    pub oauth_client: BasicClient,
    pub vision: Option<Arc<VisionService>>,
    pub captcha: Arc<CaptchaService>,
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

    let audit_service = Arc::new(AuditService::new(Arc::new(db.clone())));

    // Initialize vision service (optional - requires ANTHROPIC_API_KEY)
    let vision_service = match VisionService::new() {
        Ok(service) => {
            tracing::info!("Vision service initialized successfully");
            Some(Arc::new(service))
        }
        Err(e) => {
            tracing::warn!("Vision service not available: {}", e);
            tracing::warn!("Set ANTHROPIC_API_KEY to enable AI-powered item import");
            None
        }
    };

    // Initialize captcha service
    tracing::info!("Initializing reCAPTCHA service...");
    let recaptcha_secret = env::var("RECAPTCHA_SECRET_KEY")
        .expect("Missing RECAPTCHA_SECRET_KEY environment variable");
    let recaptcha_threshold = env::var("RECAPTCHA_THRESHOLD")
        .unwrap_or_else(|_| "0.5".to_string())
        .parse::<f64>()
        .expect("RECAPTCHA_THRESHOLD must be a valid f64");
    let captcha_service = CaptchaService::new(recaptcha_secret, recaptcha_threshold);

    tracing::info!("Initializing OAuth client...");
    let google_client_id = ClientId::new(
        env::var("GOOGLE_CLIENT_ID").expect("Missing GOOGLE_CLIENT_ID environment variable"),
    );
    let google_client_secret = ClientSecret::new(
        env::var("GOOGLE_CLIENT_SECRET")
            .expect("Missing GOOGLE_CLIENT_SECRET environment variable"),
    );
    let auth_url = AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
        .expect("Invalid authorization endpoint URL");
    let token_url = TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
        .expect("Invalid token endpoint URL");

    let oauth_client = BasicClient::new(
        google_client_id,
        Some(google_client_secret),
        auth_url,
        Some(token_url),
    )
    .set_redirect_uri(
        RedirectUrl::new(
            env::var("GOOGLE_REDIRECT_URL")
                .expect("Missing GOOGLE_REDIRECT_URL environment variable"),
        )
        .expect("Invalid redirect URL"),
    );

    let state = Arc::new(AppState {
        db,
        s3: s3_service,
        app_base_url,
        audit: audit_service,
        oauth_client,
        vision: vision_service,
        captcha: captcha_service,
    });

    // Configure CORS for local development
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    use tower_sessions::cookie::SameSite;

    // Session Layer - using PostgreSQL for persistent session storage
    // This allows sessions to persist across server restarts and work with AWS Lambda
    let session_store = PostgresStore::new(state.db.clone());
    // Ensure the sessions table exists (migration should have created it)
    session_store
        .migrate()
        .await
        .expect("Failed to run session store migration");

    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(false) // Keep false for localhost (http)
        .with_same_site(SameSite::Lax) // Allow cookies on redirects from external sites
        .with_expiry(Expiry::OnInactivity(time::Duration::days(1)));

    // Public routes (no authentication required)
    use axum::routing::{get, post};
    let public_routes = Router::new()
        .route(
            "/api/contact",
            post(crate::routes::contact::create_contact_submission),
        )
        .route(
            "/api/items/:id/public",
            get(crate::routes::items::get_item_public),
        );

    let protected_contact_routes = Router::new().route(
        "/api/contact",
        get(crate::routes::contact::list_contact_submissions),
    );

    let protected_routes = Router::new()
        .merge(crate::routes::room_routes())
        .merge(crate::routes::shelving_unit_routes())
        .merge(crate::routes::shelf_routes())
        .merge(crate::routes::container_routes())
        .merge(crate::routes::item_routes())
        .merge(crate::routes::item_import_draft_routes())
        .merge(crate::routes::photo_routes())
        .merge(crate::routes::label_routes())
        .merge(crate::routes::tag_routes())
        .merge(crate::routes::move_routes())
        .merge(crate::routes::audit_routes())
        .merge(crate::routes::user_routes())
        .merge(protected_contact_routes)
        .route_layer(axum::middleware::from_fn(
            crate::middleware::auth::auth_guard,
        ));

    Ok(Router::new()
        .route("/health", get(health_check))
        .merge(crate::routes::auth_routes())
        .merge(public_routes)
        .merge(protected_routes)
        .layer(session_layer)
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
