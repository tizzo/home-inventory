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
    CreateTagRequest, PaginatedResponse, PaginationQuery, Tag, TagResponse, UpdateTagRequest,
    AssignTagsRequest, BulkAssignTagsRequest,
};

/// Get all tags
pub async fn list_tags(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<TagResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(100).clamp(1, 1000);
    let offset = params.offset.unwrap_or(0).max(0);

    // Get total count
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tags")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count tags: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total = total.clamp(0, i32::MAX as i64) as i32;

    // Get paginated tags
    let tags = sqlx::query_as::<_, Tag>(
        "SELECT * FROM tags ORDER BY name ASC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch tags: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<TagResponse> = tags.into_iter().map(TagResponse::from).collect();
    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Get a single tag by ID
pub async fn get_tag(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<TagResponse>, StatusCode> {
    let tag = sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch tag: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(TagResponse::from(tag)))
}

/// Create a new tag
pub async fn create_tag(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<CreateTagRequest>,
) -> Result<Json<TagResponse>, StatusCode> {
    // Validate tag name
    let name = payload.name.trim();
    if name.is_empty() || name.len() > 100 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Check if tag with same name already exists
    let existing = sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE LOWER(name) = LOWER($1)")
        .bind(name)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check existing tag: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if existing.is_some() {
        return Err(StatusCode::CONFLICT);
    }

    let tag = sqlx::query_as::<_, Tag>(
        r#"
        INSERT INTO tags (id, name)
        VALUES ($1, $2)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(name)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create tag: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    state
        .audit
        .log_create("tag", tag.id, Some(user_id), None)
        .await
        .ok();

    Ok(Json(TagResponse::from(tag)))
}

/// Update a tag
pub async fn update_tag(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTagRequest>,
) -> Result<Json<TagResponse>, StatusCode> {
    // Check if tag exists
    let existing = sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch tag: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // If name is being updated, validate it
    let name = if let Some(ref new_name) = payload.name {
        let trimmed = new_name.trim();
        if trimmed.is_empty() || trimmed.len() > 100 {
            return Err(StatusCode::BAD_REQUEST);
        }

        // Check if another tag with same name exists
        let conflict = sqlx::query_as::<_, Tag>(
            "SELECT * FROM tags WHERE LOWER(name) = LOWER($1) AND id != $2",
        )
        .bind(&trimmed)
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check tag name conflict: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if conflict.is_some() {
            return Err(StatusCode::CONFLICT);
        }

        trimmed.to_string()
    } else {
        existing.name.clone()
    };

    // Track changes for audit
    let mut changes = serde_json::Map::new();
    if payload.name.is_some() && payload.name.as_ref() != Some(&existing.name) {
        changes.insert(
            "name".to_string(),
            serde_json::json!({
                "from": &existing.name,
                "to": &name
            }),
        );
    }

    let tag = sqlx::query_as::<_, Tag>(
        r#"
        UPDATE tags
        SET name = $1
        WHERE id = $2
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update tag: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    if !changes.is_empty() {
        state
            .audit
            .log_update(
                "tag",
                id,
                Some(user_id),
                serde_json::Value::Object(changes),
                None,
            )
            .await
            .ok();
    }

    Ok(Json(TagResponse::from(tag)))
}

/// Delete a tag
pub async fn delete_tag(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Log audit before deletion
    state
        .audit
        .log_delete("tag", id, Some(user_id), None)
        .await
        .ok();

    let result = sqlx::query("DELETE FROM tags WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete tag: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({ "message": "Tag deleted successfully" })))
}

/// Get tags for a specific entity
pub async fn get_entity_tags(
    State(state): State<Arc<AppState>>,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<Vec<TagResponse>>, StatusCode> {
    // Validate entity_type
    let valid_types = ["room", "unit", "shelf", "container", "item"];
    if !valid_types.contains(&entity_type.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let tags = sqlx::query_as::<_, Tag>(
        r#"
        SELECT t.* FROM tags t
        INNER JOIN entity_tags et ON t.id = et.tag_id
        WHERE et.entity_type = $1 AND et.entity_id = $2
        ORDER BY t.name ASC
        "#,
    )
    .bind(&entity_type)
    .bind(entity_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch entity tags: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<TagResponse> = tags.into_iter().map(TagResponse::from).collect();
    Ok(Json(responses))
}

/// Assign tags to an entity
pub async fn assign_tags(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<AssignTagsRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Validate entity_type
    let valid_types = ["room", "unit", "shelf", "container", "item"];
    if !valid_types.contains(&payload.entity_type.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Start transaction
    let mut tx = state.db.begin().await.map_err(|e| {
        tracing::error!("Failed to start transaction: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Remove existing tags for this entity
    sqlx::query(
        "DELETE FROM entity_tags WHERE entity_type = $1 AND entity_id = $2",
    )
    .bind(&payload.entity_type)
    .bind(payload.entity_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to remove existing tags: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Insert new tags
    for tag_id in &payload.tag_ids {
        sqlx::query(
            "INSERT INTO entity_tags (entity_type, entity_id, tag_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        )
        .bind(&payload.entity_type)
        .bind(payload.entity_id)
        .bind(tag_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to assign tag: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    state
        .audit
        .log_update(
            &payload.entity_type,
            payload.entity_id,
            Some(user_id),
            json!({
                "tags": payload.tag_ids
            }),
            None,
        )
        .await
        .ok();

    Ok(Json(json!({ "message": "Tags assigned successfully" })))
}

/// Bulk assign tags to multiple entities
pub async fn bulk_assign_tags(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<BulkAssignTagsRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Validate entity_type
    let valid_types = ["room", "unit", "shelf", "container", "item"];
    if !valid_types.contains(&payload.entity_type.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Start transaction
    let mut tx = state.db.begin().await.map_err(|e| {
        tracing::error!("Failed to start transaction: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // For each entity, assign the tags
    for entity_id in &payload.entity_ids {
        // Remove existing tags
        sqlx::query(
            "DELETE FROM entity_tags WHERE entity_type = $1 AND entity_id = $2",
        )
        .bind(&payload.entity_type)
        .bind(entity_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to remove existing tags: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        // Insert new tags
        for tag_id in &payload.tag_ids {
            sqlx::query(
                "INSERT INTO entity_tags (entity_type, entity_id, tag_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            )
            .bind(&payload.entity_type)
            .bind(entity_id)
            .bind(tag_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Failed to assign tag: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }

        // Log audit for each entity
        state
            .audit
            .log_update(
                &payload.entity_type,
                *entity_id,
                Some(user_id),
                json!({
                    "tags": payload.tag_ids
                }),
                None,
            )
            .await
            .ok();
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!({
        "message": format!("Tags assigned to {} entities", payload.entity_ids.len())
    })))
}

/// Create tag routes
pub fn tag_routes() -> Router<Arc<AppState>> {
    use axum::routing::{delete, get, post, put};

    Router::new()
        .route("/api/tags", get(list_tags).post(create_tag))
        .route("/api/tags/:id", get(get_tag).put(update_tag).delete(delete_tag))
        .route("/api/tags/entity/:entity_type/:entity_id", get(get_entity_tags))
        .route("/api/tags/assign", post(assign_tags))
        .route("/api/tags/bulk-assign", post(bulk_assign_tags))
}
