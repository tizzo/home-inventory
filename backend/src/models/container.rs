use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Container {
    pub id: Uuid,
    pub shelf_id: Option<Uuid>,
    pub parent_container_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreateContainerRequest {
    pub shelf_id: Option<Uuid>,
    pub parent_container_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct UpdateContainerRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub shelf_id: Option<Uuid>,
    pub parent_container_id: Option<Uuid>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct ContainerResponse {
    pub id: Uuid,
    pub shelf_id: Option<Uuid>,
    pub parent_container_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub label_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Container> for ContainerResponse {
    fn from(container: Container) -> Self {
        Self {
            id: container.id,
            shelf_id: container.shelf_id,
            parent_container_id: container.parent_container_id,
            name: container.name,
            description: container.description,
            label_id: container.label_id,
            created_at: container.created_at,
            updated_at: container.updated_at,
        }
    }
}
