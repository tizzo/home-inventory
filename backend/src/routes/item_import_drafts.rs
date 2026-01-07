use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::models::{
    AnalyzePhotoRequest, CommitItemImportDraftResponse, CreateItemImportDraftRequest,
    CreateItemRequest, Item, ItemImportDraft, ItemImportDraftItem, ItemImportDraftResponse,
    ItemResponse, Photo, UpdateItemImportDraftRequest,
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

    Ok(ItemImportDraftResponse {
        id: draft.id,
        container_id: draft.container_id,
        status: draft.status,
        items,
        source_photo_ids,
        created_at: draft.created_at,
        updated_at: draft.updated_at,
    })
}

pub async fn create_item_import_draft(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateItemImportDraftRequest>,
) -> Result<Json<ItemImportDraftResponse>, StatusCode> {
    // TODO: pull from session auth once route handlers do that consistently.
    let user_id = Uuid::new_v4();

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
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateItemImportDraftRequest>,
) -> Result<Json<ItemImportDraftResponse>, StatusCode> {
    // TODO: pull from session auth once route handlers do that consistently.
    let user_id = Uuid::new_v4();

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
    Path(id): Path<Uuid>,
) -> Result<Json<CommitItemImportDraftResponse>, StatusCode> {
    // TODO: pull from session auth once route handlers do that consistently.
    let user_id = Uuid::new_v4();

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
    Json(payload): Json<AnalyzePhotoRequest>,
) -> Result<Json<ItemImportDraftResponse>, StatusCode> {
    // Check if vision service is available
    let vision = state.vision.as_ref().ok_or_else(|| {
        tracing::error!("Vision service not available - ANTHROPIC_API_KEY not set");
        StatusCode::SERVICE_UNAVAILABLE
    })?;

    // TODO: pull from session auth once route handlers do that consistently
    let user_id = Uuid::new_v4();

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
        tracing::error!("Container not found: {}", payload.container_id);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Fetch photo record
    let photo = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = $1")
        .bind(payload.photo_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch photo: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or_else(|| {
            tracing::error!("Photo not found: {}", payload.photo_id);
            StatusCode::NOT_FOUND
        })?;

    // Download photo from S3
    let image_bytes = state
        .s3
        .get_object_bytes(&photo.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to download photo from S3: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Analyze with AI
    tracing::info!("Analyzing photo {} with AI...", payload.photo_id);
    let items = vision
        .analyze_image_for_items(&image_bytes, &photo.content_type)
        .await
        .map_err(|e| {
            tracing::error!("AI analysis failed: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::info!("AI found {} items in photo", items.len());

    // Create the draft
    let proposed_items = serde_json::to_value(&items).map_err(|e| {
        tracing::error!("Failed to serialize proposed items: {e:?}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let source_photo_ids = serde_json::to_value(vec![payload.photo_id]).map_err(|e| {
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
