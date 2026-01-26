use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[allow(dead_code)] // Used in database schema and will be used for user management
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub cognito_sub: String,
    pub public_display_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
#[allow(dead_code)] // Will be used when we implement user management
pub struct CreateUserRequest {
    pub email: String,
    pub name: String,
    pub cognito_sub: String,
}
