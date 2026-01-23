use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[allow(dead_code)]
pub struct Tag {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[allow(dead_code)]
pub struct EntityTag {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub tag_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct TagResponse {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreateTagRequest {
    pub name: String,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct UpdateTagRequest {
    pub name: Option<String>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct AssignTagsRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub tag_ids: Vec<Uuid>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct BulkAssignTagsRequest {
    pub entity_type: String,
    pub entity_ids: Vec<Uuid>,
    pub tag_ids: Vec<Uuid>,
}

impl From<Tag> for TagResponse {
    fn from(tag: Tag) -> Self {
        Self {
            id: tag.id,
            name: tag.name,
            created_at: tag.created_at,
        }
    }
}
