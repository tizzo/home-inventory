use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Tag {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EntityTag {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub tag_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct TagResponse {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
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
