use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemImportDraftItem {
    pub name: String,
    pub description: Option<String>,
    pub barcode: Option<String>,
    pub barcode_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ItemImportDraft {
    pub id: Uuid,
    pub container_id: Uuid,
    pub status: String,
    pub proposed_items: serde_json::Value,
    pub source_photo_ids: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreateItemImportDraftRequest {
    pub container_id: Uuid,
    pub items: Vec<ItemImportDraftItem>,
    pub source_photo_ids: Vec<Uuid>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct UpdateItemImportDraftRequest {
    pub items: Vec<ItemImportDraftItem>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct ItemImportDraftResponse {
    pub id: Uuid,
    pub container_id: Uuid,
    pub status: String,
    pub items: Vec<ItemImportDraftItem>,
    pub source_photo_ids: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
