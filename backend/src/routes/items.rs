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
use crate::models::{CreateItemRequest, Item, ItemResponse, UpdateItemRequest};

/// Get all items
pub async fn list_items(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ItemResponse>>, StatusCode> {
    let items = sqlx::query_as::<_, Item>("SELECT * FROM items ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch items: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let responses: Vec<ItemResponse> = items.into_iter().map(ItemResponse::from).collect();
    Ok(Json(responses))
}

/// Get items by shelf
pub async fn list_items_by_shelf(
    State(state): State<Arc<AppState>>,
    Path(shelf_id): Path<Uuid>,
) -> Result<Json<Vec<ItemResponse>>, StatusCode> {
    let items = sqlx::query_as::<_, Item>(
        "SELECT * FROM items WHERE shelf_id = $1 ORDER BY created_at"
    )
        .bind(shelf_id)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch items: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let responses: Vec<ItemResponse> = items.into_iter().map(ItemResponse::from).collect();
    Ok(Json(responses))
}

/// Get items by container
pub async fn list_items_by_container(
    State(state): State<Arc<AppState>>,
    Path(container_id): Path<Uuid>,
) -> Result<Json<Vec<ItemResponse>>, StatusCode> {
    let items = sqlx::query_as::<_, Item>(
        "SELECT * FROM items WHERE container_id = $1 ORDER BY created_at"
    )
        .bind(container_id)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch items: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let responses: Vec<ItemResponse> = items.into_iter().map(ItemResponse::from).collect();
    Ok(Json(responses))
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
    Json(payload): Json<CreateItemRequest>,
) -> Result<Json<ItemResponse>, StatusCode> {
    // For now, use a hardcoded user ID (we'll implement auth later)
    let user_id = Uuid::new_v4();

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
    state.audit.log_create("item", item.id, Some(user_id), None).await.ok();

    Ok(Json(ItemResponse::from(item)))
}

/// Update an item
pub async fn update_item(
    State(state): State<Arc<AppState>>,
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
    let (shelf_id, container_id) = if payload.shelf_id.is_some()
        || payload.container_id.is_some()
    {
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

    // Update fields if provided
    let name = payload.name.unwrap_or(existing.name.clone());
    let description = payload.description.or(existing.description.clone());
    let barcode = payload.barcode.or(existing.barcode.clone());
    let barcode_type = payload.barcode_type.or(existing.barcode_type.clone());

    // Track changes for audit
    let mut changes = serde_json::Map::new();
    if payload.name.is_some() && payload.name.as_ref() != Some(&existing.name) {
        changes.insert("name".to_string(), serde_json::json!({
            "from": existing.name,
            "to": name
        }));
    }
    if payload.description != existing.description {
        changes.insert("description".to_string(), serde_json::json!({
            "from": existing.description,
            "to": description
        }));
    }
    if payload.barcode != existing.barcode {
        changes.insert("barcode".to_string(), serde_json::json!({
            "from": existing.barcode,
            "to": barcode
        }));
    }
    if payload.barcode_type != existing.barcode_type {
        changes.insert("barcode_type".to_string(), serde_json::json!({
            "from": existing.barcode_type,
            "to": barcode_type
        }));
    }
    if shelf_id != existing.shelf_id || container_id != existing.container_id {
        changes.insert("location".to_string(), serde_json::json!({
            "from": {
                "shelf_id": existing.shelf_id,
                "container_id": existing.container_id
            },
            "to": {
                "shelf_id": shelf_id,
                "container_id": container_id
            }
        }));
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
        let user_id = Uuid::new_v4(); // TODO: get from auth
        state.audit.log_update("item", id, Some(user_id), serde_json::Value::Object(changes), None).await.ok();
    }

    Ok(Json(ItemResponse::from(item)))
}

/// Delete an item
pub async fn delete_item(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Log audit before deletion
    let user_id = Uuid::new_v4(); // TODO: get from auth
    state.audit.log_delete("item", id, Some(user_id), None).await.ok();

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
    use axum::routing::{delete, get, post, put};
    
    Router::new()
        .route("/api/items", get(list_items).post(create_item))
        .route(
            "/api/items/:id",
            get(get_item).put(update_item).delete(delete_item),
        )
        .route("/api/shelves/:shelf_id/items", get(list_items_by_shelf))
        .route("/api/containers/:container_id/items", get(list_items_by_container))
        .route("/api/items/barcode/:barcode", get(get_item_by_barcode))
}
