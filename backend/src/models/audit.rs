use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditLog {
    pub id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub action: String,
    pub user_id: Option<Uuid>,
    pub changes: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct AuditLogResponse {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub action: String,
    pub user_id: Option<String>,
    pub changes: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: String,
}

impl From<AuditLog> for AuditLogResponse {
    fn from(log: AuditLog) -> Self {
        Self {
            id: log.id.to_string(),
            entity_type: log.entity_type,
            entity_id: log.entity_id.to_string(),
            action: log.action,
            user_id: log.user_id.map(|u| u.to_string()),
            changes: log.changes,
            metadata: log.metadata,
            created_at: log.created_at.to_rfc3339(),
        }
    }
}
