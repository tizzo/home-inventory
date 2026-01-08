use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::middleware::auth::AuthUser;
use crate::models::{
    AnalyzePhotoRequest, CommitItemImportDraftResponse, ContainerUpdateProposal,
    CreateItemImportDraftRequest, CreateItemRequest, Item, ItemImportDraft, ItemImportDraftItem,
    ItemImportDraftResponse, ItemResponse, Photo, UpdateItemImportDraftRequest,
};

fn draft_to_response(draft: ItemImportDraft) -> Result<ItemImportDraftResponse, StatusCode> {
    let items: Vec<ItemImportDraftItem> =
        serde_json::from_value(draft.proposed_items).map_err(|e| {
            tracing::error!("Failed to parse item import draft items: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let source_photo_ids: Vec<Uuid> =
        serde_json::from_value(draft.source_photo_ids).map_err(|e| {
            tracing::error!("Failed to parse item import draft photo ids: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let container_updates: Option<ContainerUpdateProposal> = match draft.proposed_container_updates
    {
        Some(updates) => serde_json::from_value(updates).map_err(|e| {
            tracing::error!("Failed to parse container updates: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?,
        None => None,
    };

    Ok(ItemImportDraftResponse {
        id: draft.id,
        container_id: draft.container_id,
        status: draft.status,
        items,
        container_updates,
        source_photo_ids,
        created_at: draft.created_at,
        updated_at: draft.updated_at,
    })
}

pub async fn create_item_import_draft(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<CreateItemImportDraftRequest>,
) -> Result<Json<ItemImportDraftResponse>, StatusCode> {
    // Verify container exists
    let container_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
        .bind(payload.container_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify container exists: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .is_some();

    if !container_exists {
        return Err(StatusCode::BAD_REQUEST);
    }

    let proposed_items = serde_json::to_value(&payload.items).map_err(|e| {
        tracing::error!("Failed to serialize proposed items: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let source_photo_ids = serde_json::to_value(&payload.source_photo_ids).map_err(|e| {
        tracing::error!("Failed to serialize source_photo_ids: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let draft = sqlx::query_as::<_, ItemImportDraft>(
        r#"
        INSERT INTO item_import_drafts (
            id,
            container_id,
            status,
            proposed_items,
            source_photo_ids,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(payload.container_id)
    .bind("draft")
    .bind(proposed_items)
    .bind(source_photo_ids)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create item import draft: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    state
        .audit
        .log_create("item_import_draft", draft.id, Some(user_id), None)
        .await
        .ok();

    Ok(Json(draft_to_response(draft)?))
}

pub async fn get_item_import_draft(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ItemImportDraftResponse>, StatusCode> {
    let draft =
        sqlx::query_as::<_, ItemImportDraft>("SELECT * FROM item_import_drafts WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch item import draft: {e:?}");
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(draft_to_response(draft)?))
}

pub async fn update_item_import_draft(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateItemImportDraftRequest>,
) -> Result<Json<ItemImportDraftResponse>, StatusCode> {
    let existing =
        sqlx::query_as::<_, ItemImportDraft>("SELECT * FROM item_import_drafts WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch item import draft: {e:?}");
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or(StatusCode::NOT_FOUND)?;

    if existing.status != "draft" {
        return Err(StatusCode::BAD_REQUEST);
    }

    let proposed_items = serde_json::to_value(&payload.items).map_err(|e| {
        tracing::error!("Failed to serialize proposed items: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let updated = sqlx::query_as::<_, ItemImportDraft>(
        r#"
        UPDATE item_import_drafts
        SET proposed_items = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        "#,
    )
    .bind(proposed_items)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update item import draft: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    state
        .audit
        .log_update(
            "item_import_draft",
            id,
            Some(user_id),
            json!({
                "items": {
                    "from": existing.proposed_items,
                    "to": updated.proposed_items,
                }
            }),
            None,
        )
        .await
        .ok();

    Ok(Json(draft_to_response(updated)?))
}

pub async fn commit_item_import_draft(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<CommitItemImportDraftResponse>, StatusCode> {
    let mut tx = state.db.begin().await.map_err(|e| {
        tracing::error!("Failed to start transaction: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let draft = sqlx::query_as::<_, ItemImportDraft>(
        "SELECT * FROM item_import_drafts WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch item import draft: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    if draft.status != "draft" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Verify container still exists
    let container_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
        .bind(draft.container_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify container exists: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .is_some();

    if !container_exists {
        return Err(StatusCode::BAD_REQUEST);
    }

    let items: Vec<ItemImportDraftItem> = serde_json::from_value(draft.proposed_items.clone())
        .map_err(|e| {
            tracing::error!("Failed to parse proposed items: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Check if there are container updates to apply
    if let Some(updates_value) = &draft.proposed_container_updates {
        let container_updates: ContainerUpdateProposal = serde_json::from_value(updates_value.clone())
            .map_err(|e| {
                tracing::error!("Failed to parse container updates: {e:?}");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        // Update container description if provided
        if let Some(new_description) = container_updates.description {
            sqlx::query(
                "UPDATE containers SET description = $1, updated_at = NOW() WHERE id = $2"
            )
            .bind(&new_description)
            .bind(draft.container_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Failed to update container description: {e:?}");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }

        // Handle tags if provided
        if let Some(tags) = container_updates.tags {
            // First, remove existing tags
            sqlx::query("DELETE FROM entity_tags WHERE entity_type = 'container' AND entity_id = $1")
                .bind(draft.container_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to delete existing tags: {e:?}");
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            // Insert new tags
            for tag_name in tags {
                // First, ensure the tag exists
                let tag_id: Uuid = sqlx::query_scalar(
                    "INSERT INTO tags (id, name) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id"
                )
                .bind(Uuid::new_v4())
                .bind(&tag_name)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to create/get tag: {e:?}");
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

                // Link tag to container
                sqlx::query(
                    "INSERT INTO entity_tags (entity_type, entity_id, tag_id) VALUES ($1, $2, $3)"
                )
                .bind("container")
                .bind(draft.container_id)
                .bind(tag_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to link tag to container: {e:?}");
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            }
        }
    }

    let mut created_items: Vec<ItemResponse> = Vec::with_capacity(items.len());
    for item in items {
        let create_req = CreateItemRequest {
            shelf_id: None,
            container_id: Some(draft.container_id),
            name: item.name,
            description: item.description,
            barcode: item.barcode,
            barcode_type: item.barcode_type,
        };

        let created = sqlx::query_as::<_, Item>(
            r#"
            INSERT INTO items (id, shelf_id, container_id, name, description, barcode, barcode_type, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(create_req.shelf_id)
        .bind(create_req.container_id)
        .bind(&create_req.name)
        .bind(&create_req.description)
        .bind(&create_req.barcode)
        .bind(&create_req.barcode_type)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create item from draft: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        created_items.push(ItemResponse::from(created));
    }

    let updated = sqlx::query_as::<_, ItemImportDraft>(
        r#"
        UPDATE item_import_drafts
        SET status = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        "#,
    )
    .bind("committed")
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to mark draft committed: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    for item in &created_items {
        state
            .audit
            .log_create("item", item.id, Some(user_id), None)
            .await
            .ok();
    }

    state
        .audit
        .log_update(
            "item_import_draft",
            id,
            Some(user_id),
            json!({
                "status": {
                    "from": "draft",
                    "to": "committed",
                }
            }),
            None,
        )
        .await
        .ok();

    Ok(Json(CommitItemImportDraftResponse {
        draft: draft_to_response(updated)?,
        created_items,
    }))
}

/// Analyze a photo using AI and create an item import draft
pub async fn analyze_photo_and_create_draft(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<AnalyzePhotoRequest>,
) -> impl IntoResponse {
    // Check if vision service is available
    let vision = match &state.vision {
        Some(v) => v,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({
                    "error": "AI service unavailable",
                    "message": "Vision analysis is not configured. Please set ANTHROPIC_API_KEY."
                })),
            )
                .into_response();
        }
    };

    // Verify container exists
    let container_exists = match sqlx::query("SELECT id FROM containers WHERE id = $1")
        .bind(payload.container_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(result) => result.is_some(),
        Err(e) => {
            tracing::error!("Failed to verify container exists: {e:?}");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    if !container_exists {
        tracing::error!("Container not found: {}", payload.container_id);
        return StatusCode::BAD_REQUEST.into_response();
    }

    // Fetch photo record
    let photo = match sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = $1")
        .bind(payload.photo_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(photo)) => photo,
        Ok(None) => {
            tracing::error!("Photo not found: {}", payload.photo_id);
            return StatusCode::NOT_FOUND.into_response();
        }
        Err(e) => {
            tracing::error!("Failed to fetch photo: {e:?}");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // Download photo from S3
    let image_bytes = match state.s3.get_object_bytes(&photo.s3_key).await {
        Ok(bytes) => bytes,
        Err(e) => {
            tracing::error!("Failed to download photo from S3: {e:?}");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // Analyze with AI
    tracing::info!("Analyzing photo {} with AI...", payload.photo_id);
    let (items, container_updates) = match vision
        .analyze_image_for_items(&image_bytes, &photo.content_type)
        .await
    {
        Ok(result) => result,
        Err(e) => {
            tracing::error!("AI analysis failed: {e:?}");
            let error_message = e.to_string();

            // Return appropriate status code based on error
            let status = if error_message.contains("Rate limit") {
                StatusCode::TOO_MANY_REQUESTS
            } else if error_message.contains("Invalid API key") {
                StatusCode::UNAUTHORIZED
            } else if error_message.contains("Invalid request") {
                StatusCode::BAD_REQUEST
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };

            return (
                status,
                Json(serde_json::json!({
                    "error": "AI analysis failed",
                    "message": error_message
                })),
            )
                .into_response();
        }
    };

    tracing::info!("AI found {} items in photo", items.len());
    if container_updates.is_some() {
        tracing::info!("AI also suggested container updates");
    }

    // Create the draft
    let proposed_items = match serde_json::to_value(&items) {
        Ok(value) => value,
        Err(e) => {
            tracing::error!("Failed to serialize proposed items: {e:?}");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let proposed_container_updates = match container_updates {
        Some(updates) => match serde_json::to_value(&updates) {
            Ok(value) => Some(value),
            Err(e) => {
                tracing::error!("Failed to serialize container updates: {e:?}");
                return StatusCode::INTERNAL_SERVER_ERROR.into_response();
            }
        },
        None => None,
    };

    let source_photo_ids = match serde_json::to_value(vec![payload.photo_id]) {
        Ok(value) => value,
        Err(e) => {
            tracing::error!("Failed to serialize source_photo_ids: {e:?}");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let draft = match sqlx::query_as::<_, ItemImportDraft>(
        r#"
        INSERT INTO item_import_drafts (
            id,
            container_id,
            status,
            proposed_items,
            proposed_container_updates,
            source_photo_ids,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(payload.container_id)
    .bind("draft")
    .bind(proposed_items)
    .bind(proposed_container_updates)
    .bind(source_photo_ids)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(draft) => draft,
        Err(e) => {
            tracing::error!("Failed to create item import draft: {e:?}");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    state
        .audit
        .log_create("item_import_draft", draft.id, Some(user_id), None)
        .await
        .ok();

    match draft_to_response(draft) {
        Ok(response) => Json(response).into_response(),
        Err(e) => {
            tracing::error!("Failed to convert draft to response: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

pub fn item_import_draft_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/item-import-drafts", post(create_item_import_draft))
        .route(
            "/api/item-import-drafts/analyze",
            post(analyze_photo_and_create_draft),
        )
        .route(
            "/api/item-import-drafts/:id",
            get(get_item_import_draft).put(update_item_import_draft),
        )
        .route(
            "/api/item-import-drafts/:id/commit",
            post(commit_item_import_draft),
        )
}
