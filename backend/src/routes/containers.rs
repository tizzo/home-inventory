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
use crate::models::{
    Container, ContainerResponse, CreateContainerRequest, PaginatedResponse, PaginationQuery,
    UpdateContainerRequest,
};

/// Get all containers
pub async fn list_containers(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ContainerResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).min(1000).max(1);
    let offset = params.offset.unwrap_or(0).max(0);

    // Get total count
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM containers")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count containers: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Get paginated containers
    let containers = sqlx::query_as::<_, Container>(
        "SELECT * FROM containers ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch containers: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<ContainerResponse> = containers
        .into_iter()
        .map(ContainerResponse::from)
        .collect();
    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Get containers by shelf
pub async fn list_containers_by_shelf(
    State(state): State<Arc<AppState>>,
    Path(shelf_id): Path<Uuid>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ContainerResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).min(1000).max(1);
    let offset = params.offset.unwrap_or(0).max(0);

    // Get total count
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM containers WHERE shelf_id = $1")
        .bind(shelf_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count containers: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Get paginated containers
    let containers = sqlx::query_as::<_, Container>(
        "SELECT * FROM containers WHERE shelf_id = $1 ORDER BY created_at LIMIT $2 OFFSET $3",
    )
    .bind(shelf_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch containers: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<ContainerResponse> = containers
        .into_iter()
        .map(ContainerResponse::from)
        .collect();
    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Get containers by parent container
pub async fn list_containers_by_parent(
    State(state): State<Arc<AppState>>,
    Path(parent_id): Path<Uuid>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ContainerResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).min(1000).max(1);
    let offset = params.offset.unwrap_or(0).max(0);

    // Get total count
    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM containers WHERE parent_container_id = $1")
            .bind(parent_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to count containers: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    // Get paginated containers
    let containers = sqlx::query_as::<_, Container>(
        "SELECT * FROM containers WHERE parent_container_id = $1 ORDER BY created_at LIMIT $2 OFFSET $3"
    )
        .bind(parent_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch containers: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let responses: Vec<ContainerResponse> = containers
        .into_iter()
        .map(ContainerResponse::from)
        .collect();
    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Get a single container by ID
pub async fn get_container(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ContainerResponse>, StatusCode> {
    let container = sqlx::query_as::<_, Container>("SELECT * FROM containers WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch container: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(ContainerResponse::from(container)))
}

/// Create a new container
pub async fn create_container(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateContainerRequest>,
) -> Result<Json<ContainerResponse>, StatusCode> {
    // For now, use a hardcoded user ID (we'll implement auth later)
    let user_id = Uuid::new_v4();

    // Validate location constraint: exactly one of shelf_id or parent_container_id must be provided
    let (shelf_id, parent_container_id) = match (payload.shelf_id, payload.parent_container_id) {
        (Some(sid), None) => (Some(sid), None),
        (None, Some(pid)) => (None, Some(pid)),
        (Some(_), Some(_)) => {
            return Err(StatusCode::BAD_REQUEST);
        }
        (None, None) => {
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    // Verify location exists
    if let Some(sid) = shelf_id {
        let shelf_exists = sqlx::query("SELECT id FROM shelves WHERE id = $1")
            .bind(sid)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify shelf: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();

        if !shelf_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    if let Some(pid) = parent_container_id {
        let parent_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
            .bind(pid)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify parent container: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();

        if !parent_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let container = sqlx::query_as::<_, Container>(
        r#"
        INSERT INTO containers (id, shelf_id, parent_container_id, name, description, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(shelf_id)
    .bind(parent_container_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create container: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    state
        .audit
        .log_create("container", container.id, Some(user_id), None)
        .await
        .ok();

    Ok(Json(ContainerResponse::from(container)))
}

/// Update a container
pub async fn update_container(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateContainerRequest>,
) -> Result<Json<ContainerResponse>, StatusCode> {
    // Check if container exists
    let existing = sqlx::query_as::<_, Container>("SELECT * FROM containers WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch container: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Handle location changes
    let (shelf_id, parent_container_id) =
        if payload.shelf_id.is_some() || payload.parent_container_id.is_some() {
            // New location provided - validate constraint
            let new_shelf_id = payload.shelf_id.or(existing.shelf_id);
            let new_parent_id = payload.parent_container_id.or(existing.parent_container_id);

            match (new_shelf_id, new_parent_id) {
                (Some(sid), None) => {
                    // Verify shelf exists
                    let shelf_exists = sqlx::query("SELECT id FROM shelves WHERE id = $1")
                        .bind(sid)
                        .fetch_optional(&state.db)
                        .await
                        .map_err(|e| {
                            tracing::error!("Failed to verify shelf: {:?}", e);
                            StatusCode::INTERNAL_SERVER_ERROR
                        })?
                        .is_some();

                    if !shelf_exists {
                        return Err(StatusCode::BAD_REQUEST);
                    }
                    (Some(sid), None)
                }
                (None, Some(pid)) => {
                    // Verify parent exists and prevent circular reference
                    if pid == id {
                        return Err(StatusCode::BAD_REQUEST);
                    }
                    let parent_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
                        .bind(pid)
                        .fetch_optional(&state.db)
                        .await
                        .map_err(|e| {
                            tracing::error!("Failed to verify parent container: {:?}", e);
                            StatusCode::INTERNAL_SERVER_ERROR
                        })?
                        .is_some();

                    if !parent_exists {
                        return Err(StatusCode::BAD_REQUEST);
                    }
                    (None, Some(pid))
                }
                (Some(_), Some(_)) => return Err(StatusCode::BAD_REQUEST),
                (None, None) => return Err(StatusCode::BAD_REQUEST),
            }
        } else {
            // No location change
            (existing.shelf_id, existing.parent_container_id)
        };

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

    // Update fields if provided
    let name = payload.name.unwrap_or(existing.name.clone());
    let description = payload.description.or(existing.description.clone());
    if shelf_id != existing.shelf_id || parent_container_id != existing.parent_container_id {
        changes.insert(
            "location".to_string(),
            serde_json::json!({
                "from": {
                    "shelf_id": existing.shelf_id,
                    "parent_container_id": existing.parent_container_id
                },
                "to": {
                    "shelf_id": shelf_id,
                    "parent_container_id": parent_container_id
                }
            }),
        );
    }

    let container = sqlx::query_as::<_, Container>(
        r#"
        UPDATE containers
        SET name = $1, description = $2, shelf_id = $3, parent_container_id = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(shelf_id)
    .bind(parent_container_id)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update container: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    if !changes.is_empty() {
        let user_id = Uuid::new_v4(); // TODO: get from auth
        state
            .audit
            .log_update(
                "container",
                id,
                Some(user_id),
                serde_json::Value::Object(changes),
                None,
            )
            .await
            .ok();
    }

    Ok(Json(ContainerResponse::from(container)))
}

/// Delete a container
pub async fn delete_container(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Check for nested containers and items
    let nested_containers: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM containers WHERE parent_container_id = $1")
            .bind(id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to check nested containers: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let nested_items: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM items WHERE container_id = $1")
            .bind(id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to check nested items: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if nested_containers > 0 || nested_items > 0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Log audit before deletion
    let user_id = Uuid::new_v4(); // TODO: get from auth
    state
        .audit
        .log_delete("container", id, Some(user_id), None)
        .await
        .ok();

    let result = sqlx::query("DELETE FROM containers WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete container: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({ "message": "Container deleted successfully" })))
}

/// Create container routes
pub fn container_routes() -> Router<Arc<AppState>> {
    use axum::routing::get;

    Router::new()
        .route(
            "/api/containers",
            get(list_containers).post(create_container),
        )
        .route(
            "/api/containers/:id",
            get(get_container)
                .put(update_container)
                .delete(delete_container),
        )
        .route(
            "/api/shelves/:shelf_id/containers",
            get(list_containers_by_shelf),
        )
        .route(
            "/api/containers/:parent_id/children",
            get(list_containers_by_parent),
        )
}
