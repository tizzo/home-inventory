use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::models::{
    CreateItemImportDraftRequest, CreateItemRequest, Item, ItemImportDraft, ItemImportDraftItem,
    ItemImportDraftResponse, ItemResponse, UpdateItemImportDraftRequest,
};

#[derive(serde::Serialize)]
pub struct CommitItemImportDraftResponse {
    pub draft: ItemImportDraftResponse,
    pub created_items: Vec<ItemResponse>,
}

fn draft_to_response(draft: ItemImportDraft) -> Result<ItemImportDraftResponse, StatusCode> {
    let items: Vec<ItemImportDraftItem> =
        serde_json::from_value(draft.proposed_items).map_err(|e| {
            tracing::error!("Failed to deserialize draft items: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let source_photo_ids: Vec<Uuid> =
        serde_json::from_value(draft.source_photo_ids).map_err(|e| {
            tracing::error!("Failed to deserialize draft source_photo_ids: {:?}", e);
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

/// Create a new item import draft
pub async fn create_item_import_draft(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateItemImportDraftRequest>,
) -> Result<Json<ItemImportDraftResponse>, StatusCode> {
    let user_id = Uuid::new_v4();

    // Verify container exists
    let container_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
        .bind(payload.container_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify container for item import draft: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .is_some();

    if !container_exists {
        return Err(StatusCode::BAD_REQUEST);
    }

    let proposed_items = serde_json::to_value(&payload.items).map_err(|e| {
        tracing::error!("Failed to serialize draft items: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let source_photo_ids = serde_json::to_value(&payload.source_photo_ids).map_err(|e| {
        tracing::error!("Failed to serialize draft source_photo_ids: {:?}", e);
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
        tracing::error!("Failed to create item import draft: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(draft_to_response(draft)?))
}

/// Get an item import draft
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
                tracing::error!("Failed to fetch item import draft: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(draft_to_response(draft)?))
}

/// Update an item import draft
pub async fn update_item_import_draft(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateItemImportDraftRequest>,
) -> Result<Json<ItemImportDraftResponse>, StatusCode> {
    // Ensure draft exists and is editable
    let existing =
        sqlx::query_as::<_, ItemImportDraft>("SELECT * FROM item_import_drafts WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch item import draft: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or(StatusCode::NOT_FOUND)?;

    if existing.status != "draft" {
        return Err(StatusCode::BAD_REQUEST);
    }

    let proposed_items = serde_json::to_value(&payload.items).map_err(|e| {
        tracing::error!("Failed to serialize draft items: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let draft = sqlx::query_as::<_, ItemImportDraft>(
        r#"
        UPDATE item_import_drafts
        SET proposed_items = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
        "#,
    )
    .bind(proposed_items)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update item import draft: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(draft_to_response(draft)?))
}

/// Commit an item import draft (bulk create items and mark draft committed)
pub async fn commit_item_import_draft(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<CommitItemImportDraftResponse>, StatusCode> {
    let user_id = Uuid::new_v4();

    let mut tx = state.db.begin().await.map_err(|e| {
        tracing::error!(
            "Failed to start transaction for item import draft commit: {:?}",
            e
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let draft =
        sqlx::query_as::<_, ItemImportDraft>("SELECT * FROM item_import_drafts WHERE id = $1")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch item import draft for commit: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or(StatusCode::NOT_FOUND)?;

    if draft.status != "draft" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Verify container exists
    let container_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
        .bind(draft.container_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify container for item import commit: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .is_some();

    if !container_exists {
        return Err(StatusCode::BAD_REQUEST);
    }

    let draft_items: Vec<ItemImportDraftItem> =
        serde_json::from_value(draft.proposed_items.clone()).map_err(|e| {
            tracing::error!("Failed to deserialize draft items: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if draft_items.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut created_items: Vec<ItemResponse> = Vec::with_capacity(draft_items.len());

    for draft_item in draft_items {
        let create_req = CreateItemRequest {
            shelf_id: None,
            container_id: Some(draft.container_id),
            name: draft_item.name,
            description: draft_item.description,
            barcode: draft_item.barcode,
            barcode_type: draft_item.barcode_type,
        };

        let item = sqlx::query_as::<_, Item>(
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
            tracing::error!("Failed to create item during draft commit: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        created_items.push(ItemResponse::from(item));
    }

    let updated_draft = sqlx::query_as::<_, ItemImportDraft>(
        r#"
        UPDATE item_import_drafts
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
        "#,
    )
    .bind("committed")
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to mark item import draft committed: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit item import draft transaction: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    for item in &created_items {
        state
            .audit
            .log_create("item", item.id, Some(user_id), None)
            .await
            .ok();
    }

    let response = CommitItemImportDraftResponse {
        draft: draft_to_response(updated_draft)?,
        created_items,
    };

    Ok(Json(response))
}

pub fn item_import_draft_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/item-import-drafts", post(create_item_import_draft))
        .route(
            "/api/item-import-drafts/:id",
            get(get_item_import_draft).put(update_item_import_draft),
        )
        .route(
            "/api/item-import-drafts/:id/commit",
            post(commit_item_import_draft),
        )
}
