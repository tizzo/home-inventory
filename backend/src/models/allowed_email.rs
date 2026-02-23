use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[allow(dead_code)]
pub struct AllowedEmail {
    pub id: Uuid,
    pub email: String,
    pub added_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct AllowedEmailResponse {
    pub id: Uuid,
    pub email: String,
    pub added_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreateAllowedEmailRequest {
    pub email: String,
}

impl From<AllowedEmail> for AllowedEmailResponse {
    fn from(ae: AllowedEmail) -> Self {
        Self {
            id: ae.id,
            email: ae.email,
            added_by: ae.added_by,
            created_at: ae.created_at,
        }
    }
}
