use chrono::{DateTime, NaiveDate, Utc};
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
    pub product_manual_s3_key: Option<String>,
    pub receipt_s3_key: Option<String>,
    pub product_link: Option<String>,
    pub belongs_to_user_id: Option<Uuid>,
    pub acquired_date: Option<NaiveDate>,
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
    pub product_manual_s3_key: Option<String>,
    pub receipt_s3_key: Option<String>,
    pub product_link: Option<String>,
    pub belongs_to_user_id: Option<Uuid>,
    pub acquired_date: Option<NaiveDate>,
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
    pub product_manual_s3_key: Option<String>,
    pub receipt_s3_key: Option<String>,
    pub product_link: Option<String>,
    pub belongs_to_user_id: Option<Uuid>,
    pub acquired_date: Option<NaiveDate>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemResponse {
    pub id: Uuid,
    pub shelf_id: Option<Uuid>,
    pub container_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub barcode: Option<String>,
    pub barcode_type: Option<String>,
    pub label_id: Option<Uuid>,
    pub product_manual_s3_key: Option<String>,
    pub receipt_s3_key: Option<String>,
    pub product_link: Option<String>,
    pub belongs_to_user_id: Option<Uuid>,
    pub acquired_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicItemResponse {
    pub id: Uuid,
    pub name: String,
    pub owner_display_name: String,
    pub product_link: Option<String>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct BulkCreateItemsRequest {
    pub items: Vec<CreateItemRequest>,
}

#[typeshare]
#[derive(Debug, Serialize, Deserialize)]
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
            product_manual_s3_key: item.product_manual_s3_key,
            receipt_s3_key: item.receipt_s3_key,
            product_link: item.product_link,
            belongs_to_user_id: item.belongs_to_user_id,
            acquired_date: item.acquired_date,
            created_at: item.created_at,
            updated_at: item.updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_test_item() -> Item {
        Item {
            id: Uuid::new_v4(),
            shelf_id: Some(Uuid::new_v4()),
            container_id: None,
            name: "Test Item".to_string(),
            description: Some("Test Description".to_string()),
            barcode: Some("123456789".to_string()),
            barcode_type: Some("EAN13".to_string()),
            label_id: Some(Uuid::new_v4()),
            product_manual_s3_key: None,
            receipt_s3_key: None,
            product_link: None,
            belongs_to_user_id: None,
            acquired_date: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: Uuid::new_v4(),
        }
    }

    #[test]
    fn test_item_to_item_response() {
        let item = create_test_item();
        let response: ItemResponse = item.clone().into();

        assert_eq!(response.id, item.id);
        assert_eq!(response.shelf_id, item.shelf_id);
        assert_eq!(response.container_id, item.container_id);
        assert_eq!(response.name, item.name);
        assert_eq!(response.description, item.description);
        assert_eq!(response.barcode, item.barcode);
        assert_eq!(response.barcode_type, item.barcode_type);
        assert_eq!(response.label_id, item.label_id);
        assert_eq!(response.created_at, item.created_at);
        assert_eq!(response.updated_at, item.updated_at);
    }

    #[test]
    fn test_item_response_serialization() {
        let item = create_test_item();
        let response: ItemResponse = item.into();

        let json = serde_json::to_string(&response).unwrap();
        let parsed: ItemResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.id, response.id);
        assert_eq!(parsed.name, response.name);
        assert_eq!(parsed.barcode, response.barcode);
    }

    #[test]
    fn test_item_with_minimal_fields() {
        let item = Item {
            id: Uuid::new_v4(),
            shelf_id: None,
            container_id: None,
            name: "Simple Item".to_string(),
            description: None,
            barcode: None,
            barcode_type: None,
            label_id: None,
            product_manual_s3_key: None,
            receipt_s3_key: None,
            product_link: None,
            belongs_to_user_id: None,
            acquired_date: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: Uuid::new_v4(),
        };

        let response: ItemResponse = item.clone().into();

        assert_eq!(response.name, "Simple Item");
        assert_eq!(response.description, None);
        assert_eq!(response.barcode, None);
        assert_eq!(response.barcode_type, None);
    }

    #[test]
    fn test_create_item_request_deserialization() {
        let json = r#"{
            "name": "New Item",
            "description": "A new item",
            "barcode": "987654321",
            "barcode_type": "UPC"
        }"#;

        let request: CreateItemRequest = serde_json::from_str(json).unwrap();

        assert_eq!(request.name, "New Item");
        assert_eq!(request.description, Some("A new item".to_string()));
        assert_eq!(request.barcode, Some("987654321".to_string()));
        assert_eq!(request.barcode_type, Some("UPC".to_string()));
    }

    #[test]
    fn test_update_item_request_partial() {
        let json = r#"{"name": "Updated Item Name"}"#;
        let request: UpdateItemRequest = serde_json::from_str(json).unwrap();

        assert_eq!(request.name, Some("Updated Item Name".to_string()));
        assert_eq!(request.description, None);
    }

    #[test]
    fn test_bulk_create_items_request() {
        let json = r#"{
            "items": [
                {"name": "Item 1", "description": "First item"},
                {"name": "Item 2", "description": "Second item"}
            ]
        }"#;

        let request: BulkCreateItemsRequest = serde_json::from_str(json).unwrap();

        assert_eq!(request.items.len(), 2);
        assert_eq!(request.items[0].name, "Item 1");
        assert_eq!(request.items[1].name, "Item 2");
    }

    #[test]
    fn test_bulk_create_items_response() {
        let items = vec![create_test_item(), create_test_item()];

        let responses: Vec<ItemResponse> = items.into_iter().map(|i| i.into()).collect();
        let bulk_response = BulkCreateItemsResponse {
            items: responses.clone(),
        };

        assert_eq!(bulk_response.items.len(), 2);

        let json = serde_json::to_string(&bulk_response).unwrap();
        let parsed: BulkCreateItemsResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.items.len(), 2);
    }

    #[test]
    fn test_item_location_constraints() {
        // Item should have either shelf_id or container_id, but not necessarily both
        let item_on_shelf = Item {
            id: Uuid::new_v4(),
            shelf_id: Some(Uuid::new_v4()),
            container_id: None,
            name: "Shelf Item".to_string(),
            description: None,
            barcode: None,
            barcode_type: None,
            label_id: None,
            product_manual_s3_key: None,
            receipt_s3_key: None,
            product_link: None,
            belongs_to_user_id: None,
            acquired_date: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: Uuid::new_v4(),
        };

        let item_in_container = Item {
            id: Uuid::new_v4(),
            shelf_id: None,
            container_id: Some(Uuid::new_v4()),
            name: "Container Item".to_string(),
            description: None,
            barcode: None,
            barcode_type: None,
            label_id: None,
            product_manual_s3_key: None,
            receipt_s3_key: None,
            product_link: None,
            belongs_to_user_id: None,
            acquired_date: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: Uuid::new_v4(),
        };

        assert!(item_on_shelf.shelf_id.is_some());
        assert!(item_on_shelf.container_id.is_none());

        assert!(item_in_container.shelf_id.is_none());
        assert!(item_in_container.container_id.is_some());
    }
}
