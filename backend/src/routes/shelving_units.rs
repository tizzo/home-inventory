use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::models::{
    CreateShelvingUnitRequest, PaginatedResponse, PaginationQuery, ShelvingUnit,
    ShelvingUnitResponse, UpdateShelvingUnitRequest,
};

/// Get all shelving units
pub async fn list_shelving_units(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ShelvingUnitResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).min(1000).max(1);
    let offset = params.offset.unwrap_or(0).max(0);

    // Get total count
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM shelving_units")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count shelving units: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Get paginated units
    let units = sqlx::query_as::<_, ShelvingUnit>(
        "SELECT * FROM shelving_units ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch shelving units: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<ShelvingUnitResponse> =
        units.into_iter().map(ShelvingUnitResponse::from).collect();
    Ok(Json(PaginatedResponse::new(responses, total, limit, offset)))
}

/// Get shelving units by room
pub async fn list_shelving_units_by_room(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ShelvingUnitResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).min(1000).max(1);
    let offset = params.offset.unwrap_or(0).max(0);

    // Get total count
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM shelving_units WHERE room_id = $1")
        .bind(room_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count shelving units for room: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Get paginated units
    let units = sqlx::query_as::<_, ShelvingUnit>(
        "SELECT * FROM shelving_units WHERE room_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(room_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch shelving units for room: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<ShelvingUnitResponse> =
        units.into_iter().map(ShelvingUnitResponse::from).collect();
    Ok(Json(PaginatedResponse::new(responses, total, limit, offset)))
}

/// Get a single shelving unit by ID
pub async fn get_shelving_unit(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ShelvingUnitResponse>, StatusCode> {
    let unit = sqlx::query_as::<_, ShelvingUnit>("SELECT * FROM shelving_units WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch shelving unit: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(ShelvingUnitResponse::from(unit)))
}

/// Create a new shelving unit
pub async fn create_shelving_unit(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateShelvingUnitRequest>,
) -> Result<Json<ShelvingUnitResponse>, StatusCode> {
    // For now, use a hardcoded user ID (we'll implement auth later)
    let user_id = Uuid::new_v4();

    // Verify room exists
    let room_exists = sqlx::query("SELECT id FROM rooms WHERE id = $1")
        .bind(payload.room_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify room: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .is_some();

    if !room_exists {
        return Err(StatusCode::BAD_REQUEST);
    }

    let unit = sqlx::query_as::<_, ShelvingUnit>(
        r#"
        INSERT INTO shelving_units (id, room_id, name, description, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(payload.room_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create shelving unit: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    state.audit.log_create("shelving_unit", unit.id, Some(user_id), None).await.ok();

    Ok(Json(ShelvingUnitResponse::from(unit)))
}

/// Update a shelving unit
pub async fn update_shelving_unit(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateShelvingUnitRequest>,
) -> Result<Json<ShelvingUnitResponse>, StatusCode> {
    // Check if shelving unit exists
    let existing = sqlx::query_as::<_, ShelvingUnit>("SELECT * FROM shelving_units WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch shelving unit: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // If room_id is provided, verify it exists
    let room_id = if let Some(new_room_id) = payload.room_id {
        let room_exists = sqlx::query("SELECT id FROM rooms WHERE id = $1")
            .bind(new_room_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify room: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();

        if !room_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
        new_room_id
    } else {
        existing.room_id
    };

    // Track changes for audit before consuming payload
    let mut changes = serde_json::Map::new();
    if payload.name.is_some() && payload.name.as_ref() != Some(&existing.name) {
        changes.insert("name".to_string(), serde_json::json!({
            "from": &existing.name,
            "to": payload.name.as_ref().unwrap()
        }));
    }
    if payload.description.is_some() && payload.description.as_ref() != existing.description.as_ref() {
        changes.insert("description".to_string(), serde_json::json!({
            "from": &existing.description,
            "to": payload.description.as_ref()
        }));
    }

    // Update fields if provided
    let name = payload.name.unwrap_or(existing.name.clone());
    let description = payload.description.or(existing.description.clone());
    if payload.room_id.is_some() && payload.room_id != Some(existing.room_id) {
        changes.insert("room_id".to_string(), serde_json::json!({
            "from": existing.room_id,
            "to": room_id
        }));
    }

    let unit = sqlx::query_as::<_, ShelvingUnit>(
        r#"
        UPDATE shelving_units
        SET name = $1, description = $2, room_id = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(room_id)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update shelving unit: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    if !changes.is_empty() {
        let user_id = Uuid::new_v4(); // TODO: get from auth
        state.audit.log_update("shelving_unit", id, Some(user_id), serde_json::Value::Object(changes), None).await.ok();
    }

    Ok(Json(ShelvingUnitResponse::from(unit)))
}

/// Delete a shelving unit
pub async fn delete_shelving_unit(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Log audit before deletion
    let user_id = Uuid::new_v4(); // TODO: get from auth
    state.audit.log_delete("shelving_unit", id, Some(user_id), None).await.ok();

    let result = sqlx::query("DELETE FROM shelving_units WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete shelving unit: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(
        json!({ "message": "Shelving unit deleted successfully" }),
    ))
}

/// Create shelving unit routes
pub fn shelving_unit_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/units", get(list_shelving_units).post(create_shelving_unit))
        .route(
            "/api/units/:id",
            get(get_shelving_unit)
                .put(update_shelving_unit)
                .delete(delete_shelving_unit),
        )
        .route("/api/rooms/:room_id/units", get(list_shelving_units_by_room))
}
