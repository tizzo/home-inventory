mod db;
mod models;
mod routes;

use axum::{
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use routes::{create_room, delete_room, get_room, list_rooms, update_room, AppState};
use serde::Serialize;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tokio::main]
async fn main() {
    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                "home_inventory_backend=debug,tower_http=debug,sqlx=debug".into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Get database URL from environment
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:devpass@localhost:5432/inventory".to_string());

    tracing::info!("Connecting to database...");

    // Create database pool
    let db_pool = db::create_pool(&database_url)
        .await
        .expect("Failed to create database pool");

    tracing::info!("Database connection established");

    // Create app state
    let state = AppState { db: db_pool };

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router with API routes
    let app = Router::new()
        .route("/health", get(health_check))
        // Room routes
        .route("/api/rooms", get(list_rooms).post(create_room))
        .route(
            "/api/rooms/:id",
            get(get_room).put(update_room).delete(delete_room),
        )
        .with_state(state)
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http());

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to address");

    tracing::info!("Server listening on http://{}", addr);

    axum::serve(listener, app)
        .await
        .expect("Failed to start server");
}
