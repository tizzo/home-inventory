use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
#[allow(dead_code)] // Some variants will be used as we build out the API
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Unauthorized")]
    Unauthorized,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Database(ref e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error occurred")
            }
            AppError::Internal(ref msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, msg.as_str())
            }
            AppError::NotFound(ref msg) => (StatusCode::NOT_FOUND, msg.as_str()),
            AppError::Validation(ref msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized"),
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

#[allow(dead_code)] // Will be used as we build out the API
pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_error_display() {
        let err = AppError::Internal("Test error".to_string());
        assert_eq!(err.to_string(), "Internal server error: Test error");

        let err = AppError::NotFound("Resource not found".to_string());
        assert_eq!(err.to_string(), "Not found: Resource not found");

        let err = AppError::Validation("Invalid input".to_string());
        assert_eq!(err.to_string(), "Validation error: Invalid input");

        let err = AppError::Unauthorized;
        assert_eq!(err.to_string(), "Unauthorized");
    }

    #[test]
    fn test_app_error_from_sqlx_error() {
        // Test that we can convert from sqlx::Error
        // We'll use a simple error case
        let sqlx_err = sqlx::Error::PoolClosed;
        let app_err: AppError = sqlx_err.into();

        match app_err {
            AppError::Database(_) => {}
            _ => panic!("Expected Database variant"),
        }
    }

    #[tokio::test]
    async fn test_app_error_into_response_internal() {
        let err = AppError::Internal("Test internal error".to_string());
        let response = err.into_response();

        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(json["error"], "Test internal error");
    }

    #[tokio::test]
    async fn test_app_error_into_response_not_found() {
        let err = AppError::NotFound("Item not found".to_string());
        let response = err.into_response();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(json["error"], "Item not found");
    }

    #[tokio::test]
    async fn test_app_error_into_response_validation() {
        let err = AppError::Validation("Invalid name".to_string());
        let response = err.into_response();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(json["error"], "Invalid name");
    }

    #[tokio::test]
    async fn test_app_error_into_response_unauthorized() {
        let err = AppError::Unauthorized;
        let response = err.into_response();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(json["error"], "Unauthorized");
    }

    #[tokio::test]
    async fn test_app_error_into_response_database() {
        let sqlx_err = sqlx::Error::PoolClosed;
        let err: AppError = sqlx_err.into();
        let response = err.into_response();

        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(json["error"], "Database error occurred");
    }
}
