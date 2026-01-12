use serde::{Deserialize, Serialize};
use typeshare::typeshare;

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    pub search: Option<String>,
}

#[typeshare]
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i32,
    pub limit: i32,
    pub offset: i32,
}

impl<T> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, total: i32, limit: i32, offset: i32) -> Self {
        Self {
            data,
            total,
            limit,
            offset,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pagination_query_defaults() {
        let query = PaginationQuery {
            limit: None,
            offset: None,
        };

        assert_eq!(query.limit, None);
        assert_eq!(query.offset, None);
    }

    #[test]
    fn test_pagination_query_with_values() {
        let query = PaginationQuery {
            limit: Some(10),
            offset: Some(20),
        };

        assert_eq!(query.limit, Some(10));
        assert_eq!(query.offset, Some(20));
    }

    #[test]
    fn test_paginated_response_new() {
        let data = vec![1, 2, 3];
        let response = PaginatedResponse::new(data.clone(), 100, 10, 0);

        assert_eq!(response.data, data);
        assert_eq!(response.total, 100);
        assert_eq!(response.limit, 10);
        assert_eq!(response.offset, 0);
    }

    #[test]
    fn test_paginated_response_empty() {
        let response: PaginatedResponse<i32> = PaginatedResponse::new(vec![], 0, 10, 0);

        assert_eq!(response.data.len(), 0);
        assert_eq!(response.total, 0);
        assert_eq!(response.limit, 10);
        assert_eq!(response.offset, 0);
    }

    #[test]
    fn test_paginated_response_serialization() {
        let response = PaginatedResponse::new(vec!["item1", "item2"], 50, 10, 5);

        let json = serde_json::to_string(&response).unwrap();
        let parsed: PaginatedResponse<String> = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.data.len(), 2);
        assert_eq!(parsed.total, 50);
        assert_eq!(parsed.limit, 10);
        assert_eq!(parsed.offset, 5);
    }

    #[test]
    fn test_paginated_response_with_complex_types() {
        #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
        struct TestItem {
            id: i32,
            name: String,
        }

        let items = vec![
            TestItem {
                id: 1,
                name: "Item 1".to_string(),
            },
            TestItem {
                id: 2,
                name: "Item 2".to_string(),
            },
        ];

        let response = PaginatedResponse::new(items.clone(), 2, 10, 0);

        assert_eq!(response.data, items);
        assert_eq!(response.total, 2);
    }

    #[test]
    fn test_pagination_query_deserialization() {
        let json = r#"{"limit": 20, "offset": 40}"#;
        let query: PaginationQuery = serde_json::from_str(json).unwrap();

        assert_eq!(query.limit, Some(20));
        assert_eq!(query.offset, Some(40));
    }

    #[test]
    fn test_pagination_query_deserialization_partial() {
        let json = r#"{"limit": 15}"#;
        let query: PaginationQuery = serde_json::from_str(json).unwrap();

        assert_eq!(query.limit, Some(15));
        assert_eq!(query.offset, None);
    }
}
