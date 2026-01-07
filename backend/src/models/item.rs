use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Item {
    pub id: Uuid,
    pub shelf_id: Option<Uuid>,
    pub container_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub barcode: Option<String>,
    pub barcode_type: Option<String>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreateItemRequest {
    pub shelf_id: Option<Uuid>,
    pub container_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub barcode: Option<String>,
    pub barcode_type: Option<String>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct UpdateItemRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub shelf_id: Option<Uuid>,
    pub container_id: Option<Uuid>,
    pub barcode: Option<String>,
    pub barcode_type: Option<String>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct ItemResponse {
    pub id: Uuid,
    pub shelf_id: Option<Uuid>,
    pub container_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub barcode: Option<String>,
    pub barcode_type: Option<String>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct BulkCreateItemsRequest {
    pub items: Vec<CreateItemRequest>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct BulkCreateItemsResponse {
    pub items: Vec<ItemResponse>,
}

impl From<Item> for ItemResponse {
    fn from(item: Item) -> Self {
        Self {
            id: item.id,
            shelf_id: item.shelf_id,
            container_id: item.container_id,
            name: item.name,
            description: item.description,
            barcode: item.barcode,
            barcode_type: item.barcode_type,
            label_id: item.label_id,
            created_at: item.created_at,
            updated_at: item.updated_at,
        }
    }
}
