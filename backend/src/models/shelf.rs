use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Shelf {
    pub id: Uuid,
    pub shelving_unit_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub position: Option<i32>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreateShelfRequest {
    pub shelving_unit_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub position: Option<i32>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct UpdateShelfRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub position: Option<i32>,
    pub shelving_unit_id: Option<Uuid>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct ShelfResponse {
    pub id: Uuid,
    pub shelving_unit_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub position: Option<i32>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Shelf> for ShelfResponse {
    fn from(shelf: Shelf) -> Self {
        Self {
            id: shelf.id,
            shelving_unit_id: shelf.shelving_unit_id,
            name: shelf.name,
            description: shelf.description,
            position: shelf.position,
            label_id: shelf.label_id,
            created_at: shelf.created_at,
            updated_at: shelf.updated_at,
        }
    }
}
