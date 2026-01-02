use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::services::r#move as move_service;

#[derive(Debug, Deserialize)]
pub struct MoveShelfRequest {
    pub target_unit_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct MoveContainerRequest {
    pub target_shelf_id: Option<Uuid>,
    pub target_parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct MoveItemRequest {
    pub target_shelf_id: Option<Uuid>,
    pub target_container_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct MoveResponse {
    pub message: String,
}

/// Move a shelf to a different shelving unit
pub async fn move_shelf(
    State(state): State<Arc<AppState>>,
    Path(shelf_id): Path<Uuid>,
    Json(payload): Json<MoveShelfRequest>,
) -> Result<Json<MoveResponse>, StatusCode> {
    // Get current location for audit
    let current: Option<(Uuid,)> =
        sqlx::query_as("SELECT shelving_unit_id FROM shelves WHERE id = $1")
            .bind(shelf_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get shelf location: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    move_service::move_shelf(&state.db, shelf_id, payload.target_unit_id).await?;

    // Log audit
    let user_id = Uuid::new_v4(); // TODO: get from auth
    if let Some((from_unit_id,)) = current {
        state
            .audit
            .log_move(
                "shelf",
                shelf_id,
                Some(user_id),
                serde_json::json!({ "shelving_unit_id": from_unit_id }),
                serde_json::json!({ "shelving_unit_id": payload.target_unit_id }),
                None,
            )
            .await
            .ok();
    }

    Ok(Json(MoveResponse {
        message: "Shelf moved successfully".to_string(),
    }))
}

/// Move a container to a different location
pub async fn move_container(
    State(state): State<Arc<AppState>>,
    Path(container_id): Path<Uuid>,
    Json(payload): Json<MoveContainerRequest>,
) -> Result<Json<MoveResponse>, StatusCode> {
    // Get current location for audit
    let current: Option<(Option<Uuid>, Option<Uuid>)> =
        sqlx::query_as("SELECT shelf_id, parent_container_id FROM containers WHERE id = $1")
            .bind(container_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get container location: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    move_service::move_container(
        &state.db,
        container_id,
        payload.target_shelf_id,
        payload.target_parent_id,
    )
    .await?;

    // Log audit
    let user_id = Uuid::new_v4(); // TODO: get from auth
    if let Some((from_shelf, from_parent)) = current {
        state
            .audit
            .log_move(
                "container",
                container_id,
                Some(user_id),
                serde_json::json!({
                    "shelf_id": from_shelf,
                    "parent_container_id": from_parent
                }),
                serde_json::json!({
                    "shelf_id": payload.target_shelf_id,
                    "parent_container_id": payload.target_parent_id
                }),
                None,
            )
            .await
            .ok();
    }

    Ok(Json(MoveResponse {
        message: "Container moved successfully".to_string(),
    }))
}

/// Move an item to a different location
pub async fn move_item(
    State(state): State<Arc<AppState>>,
    Path(item_id): Path<Uuid>,
    Json(payload): Json<MoveItemRequest>,
) -> Result<Json<MoveResponse>, StatusCode> {
    // Get current location for audit
    let current: Option<(Option<Uuid>, Option<Uuid>)> =
        sqlx::query_as("SELECT shelf_id, container_id FROM items WHERE id = $1")
            .bind(item_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get item location: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    move_service::move_item(
        &state.db,
        item_id,
        payload.target_shelf_id,
        payload.target_container_id,
    )
    .await?;

    // Log audit
    let user_id = Uuid::new_v4(); // TODO: get from auth
    if let Some((from_shelf, from_container)) = current {
        state
            .audit
            .log_move(
                "item",
                item_id,
                Some(user_id),
                serde_json::json!({
                    "shelf_id": from_shelf,
                    "container_id": from_container
                }),
                serde_json::json!({
                    "shelf_id": payload.target_shelf_id,
                    "container_id": payload.target_container_id
                }),
                None,
            )
            .await
            .ok();
    }

    Ok(Json(MoveResponse {
        message: "Item moved successfully".to_string(),
    }))
}

/// Create move routes
pub fn move_routes() -> Router<Arc<AppState>> {
    use axum::routing::post;

    Router::new()
        .route("/api/shelves/:id/move", post(move_shelf))
        .route("/api/containers/:id/move", post(move_container))
        .route("/api/items/:id/move", post(move_item))
}
