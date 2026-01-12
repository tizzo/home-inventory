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
    BulkCreateItemsRequest, BulkCreateItemsResponse, CreateItemRequest, Item, ItemResponse,
    PaginatedResponse, PaginationQuery, UpdateItemRequest,
};

/// Get all items
pub async fn list_items(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ItemResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 1000);
    let offset = params.offset.unwrap_or(0).max(0);

    // Build search condition if provided
    let search_pattern = params.search.as_ref().map(|s| format!("%{}%", s.trim()));
    
    // Get total count with search filter
    let total: i64 = if let Some(ref pattern) = search_pattern {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM items WHERE name ILIKE $1 OR description ILIKE $1 OR barcode ILIKE $1"
        )
        .bind(pattern)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count items with search: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_scalar("SELECT COUNT(*) FROM items")
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to count items: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    };
    let total = total.clamp(0, i32::MAX as i64) as i32;

    // Get paginated items with search filter
    let items = if let Some(ref pattern) = search_pattern {
        sqlx::query_as::<_, Item>(
            "SELECT * FROM items WHERE name ILIKE $1 OR description ILIKE $1 OR barcode ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
        )
        .bind(pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch items with search: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_as::<_, Item>(
            "SELECT * FROM items ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch items: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    let responses: Vec<ItemResponse> = items.into_iter().map(ItemResponse::from).collect();
    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Get items by shelf
pub async fn list_items_by_shelf(
    State(state): State<Arc<AppState>>,
    Path(shelf_id): Path<Uuid>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ItemResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 1000);
    let offset = params.offset.unwrap_or(0).max(0);

    // Build search condition if provided
    let search_pattern = params.search.as_ref().map(|s| format!("%{}%", s.trim()));

    // Get total count with search filter
    let total: i64 = if let Some(ref pattern) = search_pattern {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM items WHERE shelf_id = $1 AND (name ILIKE $2 OR description ILIKE $2 OR barcode ILIKE $2)"
        )
        .bind(shelf_id)
        .bind(pattern)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count items with search: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_scalar("SELECT COUNT(*) FROM items WHERE shelf_id = $1")
            .bind(shelf_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to count items: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    };
    let total = total.clamp(0, i32::MAX as i64) as i32;

    // Get paginated items with search filter
    let items = if let Some(ref pattern) = search_pattern {
        sqlx::query_as::<_, Item>(
            "SELECT * FROM items WHERE shelf_id = $1 AND (name ILIKE $2 OR description ILIKE $2 OR barcode ILIKE $2) ORDER BY created_at LIMIT $3 OFFSET $4"
        )
        .bind(shelf_id)
        .bind(pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch items with search: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_as::<_, Item>(
            "SELECT * FROM items WHERE shelf_id = $1 ORDER BY created_at LIMIT $2 OFFSET $3",
        )
        .bind(shelf_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch items: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    let responses: Vec<ItemResponse> = items.into_iter().map(ItemResponse::from).collect();
    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Get items by container
pub async fn list_items_by_container(
    State(state): State<Arc<AppState>>,
    Path(container_id): Path<Uuid>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ItemResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 1000);
    let offset = params.offset.unwrap_or(0).max(0);

    // Build search condition if provided
    let search_pattern = params.search.as_ref().map(|s| format!("%{}%", s.trim()));

    // Get total count with search filter
    let total: i64 = if let Some(ref pattern) = search_pattern {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM items WHERE container_id = $1 AND (name ILIKE $2 OR description ILIKE $2 OR barcode ILIKE $2)"
        )
        .bind(container_id)
        .bind(pattern)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count items with search: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_scalar("SELECT COUNT(*) FROM items WHERE container_id = $1")
            .bind(container_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to count items: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    };
    let total = total.clamp(0, i32::MAX as i64) as i32;

    // Get paginated items with search filter
    let items = if let Some(ref pattern) = search_pattern {
        sqlx::query_as::<_, Item>(
            "SELECT * FROM items WHERE container_id = $1 AND (name ILIKE $2 OR description ILIKE $2 OR barcode ILIKE $2) ORDER BY created_at LIMIT $3 OFFSET $4"
        )
        .bind(container_id)
        .bind(pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch items with search: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_as::<_, Item>(
            "SELECT * FROM items WHERE container_id = $1 ORDER BY created_at LIMIT $2 OFFSET $3",
        )
        .bind(container_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch items: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    let responses: Vec<ItemResponse> = items.into_iter().map(ItemResponse::from).collect();
    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Get a single item by ID
pub async fn get_item(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ItemResponse>, StatusCode> {
    let item = sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch item: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(ItemResponse::from(item)))
}

/// Bulk create new items
pub async fn bulk_create_items(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<BulkCreateItemsRequest>,
) -> Result<Json<BulkCreateItemsResponse>, StatusCode> {
    if payload.items.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut tx = state.db.begin().await.map_err(|e| {
        tracing::error!("Failed to start transaction for bulk item create: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut created_items: Vec<ItemResponse> = Vec::with_capacity(payload.items.len());

    for item_req in payload.items {
        // Validate location constraint: exactly one of shelf_id or container_id must be provided
        let (shelf_id, container_id) = match (item_req.shelf_id, item_req.container_id) {
            (Some(sid), None) => (Some(sid), None),
            (None, Some(cid)) => (None, Some(cid)),
            (Some(_), Some(_)) => return Err(StatusCode::BAD_REQUEST),
            (None, None) => return Err(StatusCode::BAD_REQUEST),
        };

        // Verify location exists
        if let Some(sid) = shelf_id {
            let shelf_exists = sqlx::query("SELECT id FROM shelves WHERE id = $1")
                .bind(sid)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to verify shelf in bulk item create: {:?}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?
                .is_some();

            if !shelf_exists {
                return Err(StatusCode::BAD_REQUEST);
            }
        }

        if let Some(cid) = container_id {
            let container_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
                .bind(cid)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to verify container in bulk item create: {:?}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?
                .is_some();

            if !container_exists {
                return Err(StatusCode::BAD_REQUEST);
            }
        }

        let item = sqlx::query_as::<_, Item>(
            r#"
            INSERT INTO items (id, shelf_id, container_id, name, description, barcode, barcode_type, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(shelf_id)
        .bind(container_id)
        .bind(&item_req.name)
        .bind(&item_req.description)
        .bind(&item_req.barcode)
        .bind(&item_req.barcode_type)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create item in bulk create: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        created_items.push(ItemResponse::from(item));
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit bulk item create: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    for item in &created_items {
        state
            .audit
            .log_create("item", item.id, Some(user_id), None)
            .await
            .ok();
    }

    Ok(Json(BulkCreateItemsResponse {
        items: created_items,
    }))
}

/// Get item by barcode
pub async fn get_item_by_barcode(
    State(state): State<Arc<AppState>>,
    Path(barcode): Path<String>,
) -> Result<Json<ItemResponse>, StatusCode> {
    let item = sqlx::query_as::<_, Item>("SELECT * FROM items WHERE barcode = $1")
        .bind(&barcode)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch item by barcode: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(ItemResponse::from(item)))
}

/// Create a new item
pub async fn create_item(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<CreateItemRequest>,
) -> Result<Json<ItemResponse>, StatusCode> {
    // Validate location constraint: exactly one of shelf_id or container_id must be provided
    let (shelf_id, container_id) = match (payload.shelf_id, payload.container_id) {
        (Some(sid), None) => (Some(sid), None),
        (None, Some(cid)) => (None, Some(cid)),
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

    if let Some(cid) = container_id {
        let container_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
            .bind(cid)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify container: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();

        if !container_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let item = sqlx::query_as::<_, Item>(
        r#"
        INSERT INTO items (id, shelf_id, container_id, name, description, barcode, barcode_type, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(shelf_id)
    .bind(container_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.barcode)
    .bind(&payload.barcode_type)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create item: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    state
        .audit
        .log_create("item", item.id, Some(user_id), None)
        .await
        .ok();

    Ok(Json(ItemResponse::from(item)))
}

/// Update an item
pub async fn update_item(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateItemRequest>,
) -> Result<Json<ItemResponse>, StatusCode> {
    // Check if item exists
    let existing = sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch item: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Handle location changes
    let (shelf_id, container_id) = if payload.shelf_id.is_some() || payload.container_id.is_some() {
        // New location provided - validate constraint
        let new_shelf_id = payload.shelf_id.or(existing.shelf_id);
        let new_container_id = payload.container_id.or(existing.container_id);

        match (new_shelf_id, new_container_id) {
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
            (None, Some(cid)) => {
                // Verify container exists
                let container_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
                    .bind(cid)
                    .fetch_optional(&state.db)
                    .await
                    .map_err(|e| {
                        tracing::error!("Failed to verify container: {:?}", e);
                        StatusCode::INTERNAL_SERVER_ERROR
                    })?
                    .is_some();

                if !container_exists {
                    return Err(StatusCode::BAD_REQUEST);
                }
                (None, Some(cid))
            }
            (Some(_), Some(_)) => return Err(StatusCode::BAD_REQUEST),
            (None, None) => return Err(StatusCode::BAD_REQUEST),
        }
    } else {
        // No location change
        (existing.shelf_id, existing.container_id)
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
    if payload.barcode.is_some() && payload.barcode != existing.barcode {
        changes.insert(
            "barcode".to_string(),
            serde_json::json!({
                "from": &existing.barcode,
                "to": &payload.barcode
            }),
        );
    }
    if payload.barcode_type.is_some() && payload.barcode_type != existing.barcode_type {
        changes.insert(
            "barcode_type".to_string(),
            serde_json::json!({
                "from": &existing.barcode_type,
                "to": &payload.barcode_type
            }),
        );
    }

    // Update fields if provided
    let name = payload.name.unwrap_or(existing.name.clone());
    let description = payload.description.or(existing.description.clone());
    let barcode = payload.barcode.or(existing.barcode.clone());
    let barcode_type = payload.barcode_type.or(existing.barcode_type.clone());
    if shelf_id != existing.shelf_id || container_id != existing.container_id {
        changes.insert(
            "location".to_string(),
            serde_json::json!({
                "from": {
                    "shelf_id": existing.shelf_id,
                    "container_id": existing.container_id
                },
                "to": {
                    "shelf_id": shelf_id,
                    "container_id": container_id
                }
            }),
        );
    }

    let item = sqlx::query_as::<_, Item>(
        r#"
        UPDATE items
        SET name = $1, description = $2, shelf_id = $3, container_id = $4, 
            barcode = $5, barcode_type = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(shelf_id)
    .bind(container_id)
    .bind(&barcode)
    .bind(&barcode_type)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update item: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    if !changes.is_empty() {
        state
            .audit
            .log_update(
                "item",
                id,
                Some(user_id),
                serde_json::Value::Object(changes),
                None,
            )
            .await
            .ok();
    }

    Ok(Json(ItemResponse::from(item)))
}

/// Delete an item
pub async fn delete_item(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Log audit before deletion
    state
        .audit
        .log_delete("item", id, Some(user_id), None)
        .await
        .ok();

    let result = sqlx::query("DELETE FROM items WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete item: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({ "message": "Item deleted successfully" })))
}

/// Create item routes
pub fn item_routes() -> Router<Arc<AppState>> {
    use axum::routing::{get, post};

    Router::new()
        .route("/api/items", get(list_items).post(create_item))
        .route("/api/items/bulk", post(bulk_create_items))
        .route(
            "/api/items/:id",
            get(get_item).put(update_item).delete(delete_item),
        )
        .route("/api/shelves/:shelf_id/items", get(list_items_by_shelf))
        .route(
            "/api/containers/:container_id/items",
            get(list_items_by_container),
        )
        .route("/api/items/barcode/:barcode", get(get_item_by_barcode))
}
