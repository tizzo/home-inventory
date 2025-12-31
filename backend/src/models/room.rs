use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Room {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

#[typeshare]
#[derive(Debug, Deserialize)]
#[allow(dead_code)] // Will be used when we implement room CRUD routes
pub struct CreateRoomRequest {
    pub name: String,
    pub description: Option<String>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
#[allow(dead_code)] // Will be used when we implement room CRUD routes
pub struct UpdateRoomRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct RoomResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Room> for RoomResponse {
    fn from(room: Room) -> Self {
        Self {
            id: room.id,
            name: room.name,
            description: room.description,
            label_id: room.label_id,
            created_at: room.created_at,
            updated_at: room.updated_at,
        }
    }
}
