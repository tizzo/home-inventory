use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShelvingUnit {
    pub id: Uuid,
    pub room_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

#[typeshare]
#[derive(Debug, Deserialize)]
#[allow(dead_code)] // Will be used when we implement shelving unit CRUD routes
pub struct CreateShelvingUnitRequest {
    pub room_id: Uuid,
    pub name: String,
    pub description: Option<String>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
#[allow(dead_code)] // Will be used when we implement shelving unit CRUD routes
pub struct UpdateShelvingUnitRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub room_id: Option<Uuid>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct ShelvingUnitResponse {
    pub id: Uuid,
    pub room_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ShelvingUnit> for ShelvingUnitResponse {
    fn from(unit: ShelvingUnit) -> Self {
        Self {
            id: unit.id,
            room_id: unit.room_id,
            name: unit.name,
            description: unit.description,
            label_id: unit.label_id,
            created_at: unit.created_at,
            updated_at: unit.updated_at,
        }
    }
}
