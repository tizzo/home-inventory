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
use crate::services::move as move_service;

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
    move_service::move_shelf(&state.db, shelf_id, payload.target_unit_id).await?;

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
    move_service::move_container(
        &state.db,
        container_id,
        payload.target_shelf_id,
        payload.target_parent_id,
    )
    .await?;

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
    move_service::move_item(
        &state.db,
        item_id,
        payload.target_shelf_id,
        payload.target_container_id,
    )
    .await?;

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
