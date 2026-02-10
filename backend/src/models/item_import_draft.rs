use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

use crate::models::ItemResponse;

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
    pub container_id: Option<Uuid>,
    pub shelf_id: Option<Uuid>,
    pub room_id: Option<Uuid>,
    pub hint: Option<String>,
    pub status: String,
    pub proposed_items: serde_json::Value,
    pub proposed_location_updates: Option<serde_json::Value>,
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationUpdateProposal {
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
}

// Backward compatibility alias
#[allow(dead_code)]
pub type ContainerUpdateProposal = LocationUpdateProposal;

#[typeshare]
#[derive(Debug, Serialize)]
pub struct ItemImportDraftResponse {
    pub id: Uuid,
    pub container_id: Option<Uuid>,
    pub shelf_id: Option<Uuid>,
    pub room_id: Option<Uuid>,
    pub hint: Option<String>,
    pub status: String,
    pub items: Vec<ItemImportDraftItem>,
    pub location_updates: Option<LocationUpdateProposal>,
    pub source_photo_ids: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct CommitItemImportDraftResponse {
    pub draft: ItemImportDraftResponse,
    pub created_items: Vec<ItemResponse>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct AnalyzePhotoRequest {
    pub container_id: Option<Uuid>,
    pub shelf_id: Option<Uuid>,
    pub room_id: Option<Uuid>,
    pub photo_ids: Vec<Uuid>,
    pub hint: Option<String>,
}

impl AnalyzePhotoRequest {
    pub fn validate_location(&self) -> Result<(), &'static str> {
        let count = [
            self.container_id.is_some(),
            self.shelf_id.is_some(),
            self.room_id.is_some(),
        ]
        .iter()
        .filter(|&&x| x)
        .count();
        if count > 1 {
            return Err("At most one of container_id, shelf_id, or room_id must be provided");
        }
        // 0 = unplaced, 1 = placed — both OK
        Ok(())
    }
}
