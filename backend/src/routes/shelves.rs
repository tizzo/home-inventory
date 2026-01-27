use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    Router,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::middleware::auth::AuthUser;
use crate::models::{
    CreateShelfRequest, PaginatedResponse, PaginationQuery, Shelf, ShelfResponse,
    UpdateShelfRequest,
};

/// Get all shelves
pub async fn list_shelves(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ShelfResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 1000);
    let offset = params.offset.unwrap_or(0).max(0);

    // Get total count
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM shelves")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count shelves: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total = total.clamp(0, i32::MAX as i64) as i32;

    // Get paginated shelves
    let shelves = sqlx::query_as::<_, Shelf>(
        "SELECT * FROM shelves ORDER BY shelving_unit_id, COALESCE(position, 0), created_at LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch shelves: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<ShelfResponse> = shelves.into_iter().map(ShelfResponse::from).collect();
    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Get shelves by shelving unit
pub async fn list_shelves_by_unit(
    State(state): State<Arc<AppState>>,
    Path(unit_id): Path<Uuid>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ShelfResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 1000);
    let offset = params.offset.unwrap_or(0).max(0);

    // Get total count
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM shelves WHERE shelving_unit_id = $1")
        .bind(unit_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count shelves: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total = total.clamp(0, i32::MAX as i64) as i32;

    // Get paginated shelves
    let shelves = sqlx::query_as::<_, Shelf>(
        "SELECT * FROM shelves WHERE shelving_unit_id = $1 ORDER BY COALESCE(position, 0), created_at LIMIT $2 OFFSET $3"
    )
        .bind(unit_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch shelves: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let responses: Vec<ShelfResponse> = shelves.into_iter().map(ShelfResponse::from).collect();
    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Get a single shelf by ID
pub async fn get_shelf(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ShelfResponse>, StatusCode> {
    let shelf = sqlx::query_as::<_, Shelf>("SELECT * FROM shelves WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch shelf: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(ShelfResponse::from(shelf)))
}

/// Create a new shelf
pub async fn create_shelf(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<CreateShelfRequest>,
) -> Result<Json<ShelfResponse>, StatusCode> {
    // Verify shelving unit exists
    let unit_exists = sqlx::query("SELECT id FROM shelving_units WHERE id = $1")
        .bind(payload.shelving_unit_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify shelving unit: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .is_some();

    if !unit_exists {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Auto-assign position if not provided
    let position = if let Some(pos) = payload.position {
        Some(pos)
    } else {
        let max_position: Option<i32> =
            sqlx::query_scalar("SELECT MAX(position) FROM shelves WHERE shelving_unit_id = $1")
                .bind(payload.shelving_unit_id)
                .fetch_one(&state.db)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to get max position: {:?}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

        Some(max_position.unwrap_or(0) + 1)
    };

    let shelf = sqlx::query_as::<_, Shelf>(
        r#"
        INSERT INTO shelves (id, shelving_unit_id, name, description, position, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(payload.shelving_unit_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(position)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create shelf: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    state
        .audit
        .log_create("shelf", shelf.id, Some(user_id), None)
        .await
        .ok();

    Ok(Json(ShelfResponse::from(shelf)))
}

/// Update a shelf
pub async fn update_shelf(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateShelfRequest>,
) -> Result<Json<ShelfResponse>, StatusCode> {
    // Check if shelf exists
    let existing = sqlx::query_as::<_, Shelf>("SELECT * FROM shelves WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch shelf: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // If shelving_unit_id is provided, verify it exists
    let shelving_unit_id = if let Some(new_unit_id) = payload.shelving_unit_id {
        let unit_exists = sqlx::query("SELECT id FROM shelving_units WHERE id = $1")
            .bind(new_unit_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify shelving unit: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();

        if !unit_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
        new_unit_id
    } else {
        existing.shelving_unit_id
    };

    // Track changes for audit before consuming payload
    let mut changes = serde_json::Map::new();
    if let Some(ref new_name) = payload.name {
        if new_name != &existing.name {
            changes.insert(
                "name".to_string(),
                serde_json::json!({
                    "from": &existing.name,
                    "to": new_name
                }),
            );
        }
    }
    if payload.description.is_some()
        && payload.description.as_ref() != existing.description.as_ref()
    {
        changes.insert(
            "description".to_string(),
            serde_json::json!({
                "from": &existing.description,
                "to": payload.description.as_ref()
            }),
        );
    }
    if payload.position.is_some() && payload.position != existing.position {
        changes.insert(
            "position".to_string(),
            serde_json::json!({
                "from": existing.position,
                "to": payload.position
            }),
        );
    }

    // Update fields if provided
    let name = payload.name.unwrap_or(existing.name.clone());
    let description = payload.description.or(existing.description.clone());
    let position = payload.position.or(existing.position);
    if payload.shelving_unit_id.is_some()
        && payload.shelving_unit_id != Some(existing.shelving_unit_id)
    {
        changes.insert(
            "shelving_unit_id".to_string(),
            serde_json::json!({
                "from": existing.shelving_unit_id,
                "to": shelving_unit_id
            }),
        );
    }

    let shelf = sqlx::query_as::<_, Shelf>(
        r#"
        UPDATE shelves
        SET name = $1, description = $2, position = $3, shelving_unit_id = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(position)
    .bind(shelving_unit_id)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update shelf: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    if !changes.is_empty() {
        state
            .audit
            .log_update(
                "shelf",
                id,
                Some(user_id),
                serde_json::Value::Object(changes),
                None,
            )
            .await
            .ok();
    }

    Ok(Json(ShelfResponse::from(shelf)))
}

/// Delete a shelf
pub async fn delete_shelf(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Log audit before deletion
    state
        .audit
        .log_delete("shelf", id, Some(user_id), None)
        .await
        .ok();

    let result = sqlx::query("DELETE FROM shelves WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete shelf: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({ "message": "Shelf deleted successfully" })))
}

/// Create shelf routes
pub fn shelf_routes() -> Router<Arc<AppState>> {
    #[allow(unused_imports)]
    use axum::routing::{delete, get, post, put};

    Router::new()
        .route("/api/shelves", get(list_shelves).post(create_shelf))
        .route(
            "/api/shelves/:id",
            get(get_shelf).put(update_shelf).delete(delete_shelf),
        )
        .route("/api/units/:unit_id/shelves", get(list_shelves_by_unit))
}
