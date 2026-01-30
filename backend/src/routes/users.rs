use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    Router,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::app::AppState;
use crate::models::User;

#[derive(Debug, Deserialize)]
pub struct UsersQuery {
    pub search: Option<String>,
}

/// List all users (with optional search)
pub async fn list_users(
    State(state): State<Arc<AppState>>,
    Query(params): Query<UsersQuery>,
) -> Result<Json<Vec<User>>, StatusCode> {
    let users = if let Some(search) = params.search {
        let pattern = format!("%{}%", search.trim());
        sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY name LIMIT 100",
        )
        .bind(&pattern)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to search users: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY name LIMIT 100")
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch users: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    };

    Ok(Json(users))
}

/// Create user routes
pub fn user_routes() -> Router<Arc<AppState>> {
    use axum::routing::get;

    Router::new().route("/api/users", get(list_users))
}
