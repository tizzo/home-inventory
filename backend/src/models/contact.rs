use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContactSubmission {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub subject: String,
    pub message: String,
    pub item_id: Option<Uuid>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreateContactSubmissionRequest {
    pub name: String,
    pub email: String,
    pub subject: String,
    pub message: String,
    pub item_id: Option<Uuid>,
    pub recaptcha_token: String,
}

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactSubmissionResponse {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub subject: String,
    pub message: String,
    pub item_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl From<ContactSubmission> for ContactSubmissionResponse {
    fn from(submission: ContactSubmission) -> Self {
        Self {
            id: submission.id,
            name: submission.name,
            email: submission.email,
            subject: submission.subject,
            message: submission.message,
            item_id: submission.item_id,
            created_at: submission.created_at,
        }
    }
}
