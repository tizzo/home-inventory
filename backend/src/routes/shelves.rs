use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    Router,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::models::{CreateShelfRequest, Shelf, ShelfResponse, UpdateShelfRequest};

/// Get all shelves
pub async fn list_shelves(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ShelfResponse>>, StatusCode> {
    let shelves = sqlx::query_as::<_, Shelf>(
        "SELECT * FROM shelves ORDER BY shelving_unit_id, COALESCE(position, 0), created_at",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch shelves: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<ShelfResponse> = shelves.into_iter().map(ShelfResponse::from).collect();
    Ok(Json(responses))
}

/// Get shelves by shelving unit
pub async fn list_shelves_by_unit(
    State(state): State<Arc<AppState>>,
    Path(unit_id): Path<Uuid>,
) -> Result<Json<Vec<ShelfResponse>>, StatusCode> {
    let shelves = sqlx::query_as::<_, Shelf>(
        "SELECT * FROM shelves WHERE shelving_unit_id = $1 ORDER BY COALESCE(position, 0), created_at"
    )
        .bind(unit_id)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch shelves: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let responses: Vec<ShelfResponse> = shelves.into_iter().map(ShelfResponse::from).collect();
    Ok(Json(responses))
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
    Json(payload): Json<CreateShelfRequest>,
) -> Result<Json<ShelfResponse>, StatusCode> {
    // For now, use a hardcoded user ID (we'll implement auth later)
    let user_id = Uuid::new_v4();

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
                .fetch_optional(&state.db)
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

    Ok(Json(ShelfResponse::from(shelf)))
}

/// Update a shelf
pub async fn update_shelf(
    State(state): State<Arc<AppState>>,
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

    // Update fields if provided
    let name = payload.name.unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let position = payload.position.or(existing.position);

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
    .bind(&position)
    .bind(shelving_unit_id)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update shelf: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(ShelfResponse::from(shelf)))
}

/// Delete a shelf
pub async fn delete_shelf(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
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
    use axum::routing::{delete, get, post, put};

    Router::new()
        .route("/api/shelves", get(list_shelves).post(create_shelf))
        .route(
            "/api/shelves/:id",
            get(get_shelf).put(update_shelf).delete(delete_shelf),
        )
        .route("/api/units/:unit_id/shelves", get(list_shelves_by_unit))
}
