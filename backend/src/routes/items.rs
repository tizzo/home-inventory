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
    PaginatedResponse, PaginationQuery, PublicItemResponse, UpdateItemRequest,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct FileUploadRequest {
    pub file_type: String, // "manual" or "receipt"
    pub content_type: String,
}

#[derive(Debug, Serialize)]
pub struct FileUploadResponse {
    pub upload_url: String,
    pub s3_key: String,
}

#[derive(Debug, Deserialize)]
pub struct FileDownloadRequest {
    pub s3_key: String,
}

#[derive(Debug, Serialize)]
pub struct FileDownloadResponse {
    pub download_url: String,
}

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
            INSERT INTO items (id, shelf_id, container_id, name, description, barcode, barcode_type,
                              product_manual_s3_key, receipt_s3_key, product_link,
                              belongs_to_user_id, acquired_date, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        .bind(&item_req.product_manual_s3_key)
        .bind(&item_req.receipt_s3_key)
        .bind(&item_req.product_link)
        .bind(&item_req.belongs_to_user_id)
        .bind(&item_req.acquired_date)
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
        INSERT INTO items (id, shelf_id, container_id, name, description, barcode, barcode_type,
                          product_manual_s3_key, receipt_s3_key, product_link,
                          belongs_to_user_id, acquired_date, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
    .bind(&payload.product_manual_s3_key)
    .bind(&payload.receipt_s3_key)
    .bind(&payload.product_link)
    .bind(&payload.belongs_to_user_id)
    .bind(&payload.acquired_date)
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
    if payload.product_manual_s3_key.is_some() && payload.product_manual_s3_key != existing.product_manual_s3_key {
        changes.insert(
            "product_manual_s3_key".to_string(),
            serde_json::json!({
                "from": &existing.product_manual_s3_key,
                "to": &payload.product_manual_s3_key
            }),
        );
    }
    if payload.receipt_s3_key.is_some() && payload.receipt_s3_key != existing.receipt_s3_key {
        changes.insert(
            "receipt_s3_key".to_string(),
            serde_json::json!({
                "from": &existing.receipt_s3_key,
                "to": &payload.receipt_s3_key
            }),
        );
    }
    if payload.product_link.is_some() && payload.product_link != existing.product_link {
        changes.insert(
            "product_link".to_string(),
            serde_json::json!({
                "from": &existing.product_link,
                "to": &payload.product_link
            }),
        );
    }
    if payload.belongs_to_user_id.is_some() && payload.belongs_to_user_id != existing.belongs_to_user_id {
        changes.insert(
            "belongs_to_user_id".to_string(),
            serde_json::json!({
                "from": &existing.belongs_to_user_id,
                "to": &payload.belongs_to_user_id
            }),
        );
    }
    if payload.acquired_date.is_some() && payload.acquired_date != existing.acquired_date {
        changes.insert(
            "acquired_date".to_string(),
            serde_json::json!({
                "from": &existing.acquired_date,
                "to": &payload.acquired_date
            }),
        );
    }

    // Update fields if provided
    let name = payload.name.unwrap_or(existing.name.clone());
    let description = payload.description.or(existing.description.clone());
    let barcode = payload.barcode.or(existing.barcode.clone());
    let barcode_type = payload.barcode_type.or(existing.barcode_type.clone());
    let product_manual_s3_key = payload.product_manual_s3_key.or(existing.product_manual_s3_key.clone());
    let receipt_s3_key = payload.receipt_s3_key.or(existing.receipt_s3_key.clone());
    let product_link = payload.product_link.or(existing.product_link.clone());
    let belongs_to_user_id = payload.belongs_to_user_id.or(existing.belongs_to_user_id);
    let acquired_date = payload.acquired_date.or(existing.acquired_date);
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
            barcode = $5, barcode_type = $6,
            product_manual_s3_key = $7, receipt_s3_key = $8, product_link = $9,
            belongs_to_user_id = $10, acquired_date = $11, updated_at = NOW()
        WHERE id = $12
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(shelf_id)
    .bind(container_id)
    .bind(&barcode)
    .bind(&barcode_type)
    .bind(&product_manual_s3_key)
    .bind(&receipt_s3_key)
    .bind(&product_link)
    .bind(&belongs_to_user_id)
    .bind(&acquired_date)
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

/// Get presigned URL for file download
pub async fn get_file_download_url(
    State(state): State<Arc<AppState>>,
    AuthUser(_user_id): AuthUser,
    Json(payload): Json<FileDownloadRequest>,
) -> Result<Json<FileDownloadResponse>, StatusCode> {
    // Get presigned download URL
    let download_url = state
        .s3
        .generate_presigned_download_url(&payload.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate presigned download URL: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(FileDownloadResponse { download_url }))
}

/// Get presigned URL for file upload (manual or receipt)
pub async fn get_file_upload_url(
    State(state): State<Arc<AppState>>,
    AuthUser(_user_id): AuthUser,
    Json(payload): Json<FileUploadRequest>,
) -> Result<Json<FileUploadResponse>, StatusCode> {
    // Validate file type
    if payload.file_type != "manual" && payload.file_type != "receipt" {
        tracing::warn!("Invalid file type: {}", payload.file_type);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Generate S3 key
    let file_extension = match payload.content_type.as_str() {
        "application/pdf" => "pdf",
        ct if ct.starts_with("image/") => {
            ct.strip_prefix("image/").unwrap_or("jpg")
        }
        _ => {
            tracing::warn!("Unsupported content type: {}", payload.content_type);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    let s3_key = format!(
        "items/{}/{}.{}",
        payload.file_type,
        Uuid::new_v4(),
        file_extension
    );

    // Get presigned upload URL
    let upload_url = state
        .s3
        .generate_presigned_upload_url_for_key(&s3_key, &payload.content_type)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate presigned upload URL: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(FileUploadResponse {
        upload_url,
        s3_key,
    }))
}

/// Create item routes
pub fn item_routes() -> Router<Arc<AppState>> {
    use axum::routing::{get, post};

    Router::new()
        .route("/api/items", get(list_items).post(create_item))
        // Specific routes MUST come before parameterized routes
        .route("/api/items/bulk", post(bulk_create_items))
        .route("/api/items/file-upload-url", post(get_file_upload_url))
        .route("/api/items/file-download-url", post(get_file_download_url))
        .route("/api/items/barcode/:barcode", get(get_item_by_barcode))
        // Parameterized route comes last
        .route(
            "/api/items/:id",
            get(get_item).put(update_item).delete(delete_item),
        )
        .route("/api/shelves/:shelf_id/items", get(list_items_by_shelf))
        .route(
            "/api/containers/:container_id/items",
            get(list_items_by_container),
        )
}

/// Get public item view (no authentication required)
/// Returns limited information about an item for public viewing
pub async fn get_item_public(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<PublicItemResponse>, StatusCode> {
    // Join items with users to get owner display name
    let result: Option<(Uuid, String, Option<String>, Option<String>, String)> = sqlx::query_as(
        r#"
        SELECT i.id, i.name, i.product_link, u.public_display_name, u.name as user_name
        FROM items i
        INNER JOIN users u ON i.created_by = u.id
        WHERE i.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch public item: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match result {
        Some((item_id, name, product_link, public_display_name, user_name)) => {
            let owner_display_name = public_display_name.unwrap_or(user_name);
            Ok(Json(PublicItemResponse {
                id: item_id,
                name,
                owner_display_name,
                product_link,
            }))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}
