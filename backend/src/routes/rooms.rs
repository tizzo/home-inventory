use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::models::{CreateRoomRequest, Room, RoomResponse, UpdateRoomRequest};

/// Get all rooms
pub async fn list_rooms(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<RoomResponse>>, StatusCode> {
    let rooms = sqlx::query_as::<_, Room>("SELECT * FROM rooms ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch rooms: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let responses: Vec<RoomResponse> = rooms.into_iter().map(RoomResponse::from).collect();
    Ok(Json(responses))
}

/// Get a single room by ID
pub async fn get_room(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<RoomResponse>, StatusCode> {
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch room: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(RoomResponse::from(room)))
}

/// Create a new room
pub async fn create_room(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateRoomRequest>,
) -> Result<Json<RoomResponse>, StatusCode> {
    // For now, use a hardcoded user ID (we'll implement auth later)
    let user_id = Uuid::new_v4();

    let room = sqlx::query_as::<_, Room>(
        r#"
        INSERT INTO rooms (id, name, description, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create room: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    state
        .audit
        .log_create("room", room.id, Some(user_id), None)
        .await
        .ok();

    Ok(Json(RoomResponse::from(room)))
}

/// Update a room
pub async fn update_room(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRoomRequest>,
) -> Result<Json<RoomResponse>, StatusCode> {
    // Check if room exists
    let existing = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch room: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Track changes for audit before consuming payload
    let mut changes = serde_json::Map::new();
    if payload.name.is_some() && payload.name.as_ref() != Some(&existing.name) {
        changes.insert(
            "name".to_string(),
            serde_json::json!({
                "from": &existing.name,
                "to": payload.name.as_ref().unwrap()
            }),
        );
    }
    if payload.description.is_some() && payload.description.as_ref() != existing.description.as_ref() {
        changes.insert(
            "description".to_string(),
            serde_json::json!({
                "from": &existing.description,
                "to": payload.description.as_ref()
            }),
        );
    }

    // Update fields if provided
    let name = payload.name.unwrap_or(existing.name.clone());
    let description = payload.description.or(existing.description.clone());

    let room = sqlx::query_as::<_, Room>(
        r#"
        UPDATE rooms
        SET name = $1, description = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update room: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    if !changes.is_empty() {
        let user_id = Uuid::new_v4(); // TODO: get from auth
        state
            .audit
            .log_update(
                "room",
                id,
                Some(user_id),
                serde_json::Value::Object(changes),
                None,
            )
            .await
            .ok();
    }

    Ok(Json(RoomResponse::from(room)))
}

/// Delete a room
pub async fn delete_room(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Log audit before deletion
    let user_id = Uuid::new_v4(); // TODO: get from auth
    state
        .audit
        .log_delete("room", id, Some(user_id), None)
        .await
        .ok();

    let result = sqlx::query("DELETE FROM rooms WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete room: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({ "message": "Room deleted successfully" })))
}

/// Create room routes
pub fn room_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/rooms", get(list_rooms).post(create_room))
        .route(
            "/api/rooms/:id",
            get(get_room).put(update_room).delete(delete_room),
        )
}
