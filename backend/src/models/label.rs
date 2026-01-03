use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Label {
    pub id: Uuid,
    pub number: i32,
    pub qr_data: String,
    pub batch_id: Option<Uuid>,
    pub assigned_to_type: Option<String>,
    pub assigned_to_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub assigned_at: Option<DateTime<Utc>>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct GenerateLabelsRequest {
    pub count: i32,
    pub template: Option<String>, // Default to "avery_18660"
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct GenerateLabelsResponse {
    pub batch_id: Uuid,
    pub labels: Vec<LabelResponse>,
    pub count: i32,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct LabelResponse {
    pub id: Uuid,
    pub number: i32,
    pub qr_data: String,
    pub batch_id: Option<Uuid>,
    pub assigned_to_type: Option<String>,
    pub assigned_to_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub assigned_at: Option<DateTime<Utc>>,
}

impl From<Label> for LabelResponse {
    fn from(label: Label) -> Self {
        Self {
            id: label.id,
            number: label.number,
            qr_data: label.qr_data,
            batch_id: label.batch_id,
            assigned_to_type: label.assigned_to_type,
            assigned_to_id: label.assigned_to_id,
            created_at: label.created_at,
            assigned_at: label.assigned_at,
        }
    }
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct AssignLabelRequest {
    pub assigned_to_type: String, // 'room', 'unit', 'shelf', 'container', 'item'
    pub assigned_to_id: Uuid,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct BatchWithLabels {
    pub batch_id: Uuid,
    pub labels: Vec<LabelResponse>,
    pub created_at: DateTime<Utc>,
}
