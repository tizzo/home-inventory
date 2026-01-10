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
#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_test_container() -> Container {
        Container {
            id: Uuid::new_v4(),
            shelf_id: Some(Uuid::new_v4()),
            parent_container_id: None,
            name: "Test Container".to_string(),
            description: Some("Test Description".to_string()),
            label_id: Some(Uuid::new_v4()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: Uuid::new_v4(),
        }
    }

    #[test]
    fn test_container_to_container_response() {
        let container = create_test_container();
        let response: ContainerResponse = container.clone().into();

        assert_eq!(response.id, container.id);
        assert_eq!(response.shelf_id, container.shelf_id);
        assert_eq!(response.parent_container_id, container.parent_container_id);
        assert_eq!(response.name, container.name);
        assert_eq!(response.description, container.description);
        assert_eq!(response.label_id, container.label_id);
        assert_eq!(response.created_at, container.created_at);
        assert_eq!(response.updated_at, container.updated_at);
    }

    #[test]
    fn test_container_response_serialization() {
        let container = create_test_container();
        let response: ContainerResponse = container.into();

        let json = serde_json::to_string(&response).unwrap();
        let parsed: ContainerResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.id, response.id);
        assert_eq!(parsed.name, response.name);
    }

    #[test]
    fn test_container_with_none_fields() {
        let container = Container {
            id: Uuid::new_v4(),
            shelf_id: None,
            parent_container_id: None,
            name: "Standalone Container".to_string(),
            description: None,
            label_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: Uuid::new_v4(),
        };

        let response: ContainerResponse = container.clone().into();

        assert_eq!(response.shelf_id, None);
        assert_eq!(response.parent_container_id, None);
        assert_eq!(response.description, None);
        assert_eq!(response.label_id, None);
    }

    #[test]
    fn test_create_container_request_deserialization() {
        let json = r#"{
            "name": "New Container",
            "description": "A new container",
            "shelf_id": null,
            "parent_container_id": null
        }"#;

        let request: CreateContainerRequest = serde_json::from_str(json).unwrap();

        assert_eq!(request.name, "New Container");
        assert_eq!(request.description, Some("A new container".to_string()));
        assert_eq!(request.shelf_id, None);
        assert_eq!(request.parent_container_id, None);
    }

    #[test]
    fn test_update_container_request_partial() {
        let json = r#"{"name": "Updated Name"}"#;
        let request: UpdateContainerRequest = serde_json::from_str(json).unwrap();

        assert_eq!(request.name, Some("Updated Name".to_string()));
        assert_eq!(request.description, None);
        assert_eq!(request.shelf_id, None);
        assert_eq!(request.parent_container_id, None);
    }

    #[test]
    fn test_update_container_request_all_fields() {
        let shelf_id = Uuid::new_v4();
        let parent_id = Uuid::new_v4();
        let json = format!(
            r#"{{
                "name": "Updated",
                "description": "New description",
                "shelf_id": "{}",
                "parent_container_id": "{}"
            }}"#,
            shelf_id, parent_id
        );

        let request: UpdateContainerRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(request.name, Some("Updated".to_string()));
        assert_eq!(request.description, Some("New description".to_string()));
        assert_eq!(request.shelf_id, Some(shelf_id));
        assert_eq!(request.parent_container_id, Some(parent_id));
    }
}
