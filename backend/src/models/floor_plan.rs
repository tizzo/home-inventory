use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

/// An uploaded floor plan image that rooms can be linked to.
#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FloorPlan {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub s3_key: String,
    pub content_type: String,
    pub file_size: i32,
    pub width: i32,
    pub height: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct FloorPlanResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    /// Presigned URL for viewing the image
    pub url: String,
    pub content_type: String,
    pub file_size: i32,
    pub width: i32,
    pub height: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct FloorPlanUploadUrlRequest {
    pub content_type: String,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreateFloorPlanRequest {
    pub name: String,
    pub description: Option<String>,
    /// Key returned by the upload-url endpoint
    pub s3_key: String,
    pub content_type: String,
    pub width: i32,
    pub height: i32,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct UpdateFloorPlanRequest {
    pub name: Option<String>,
    /// An empty string clears the description
    pub description: Option<String>,
}

/// Where a shelving unit sits on its floor plan, as a percentage of the image
/// measured from the top-left corner.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct UnitPosition {
    pub x_percent: f64,
    pub y_percent: f64,
}

#[typeshare]
#[derive(Debug, Clone, Serialize)]
pub struct FloorPlanUnit {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    /// Missing when the unit has not been placed yet
    pub position: Option<UnitPosition>,
}

#[typeshare]
#[derive(Debug, Clone, Serialize)]
pub struct FloorPlanRoom {
    pub id: Uuid,
    pub name: String,
    pub units: Vec<FloorPlanUnit>,
}

/// A floor plan with every room linked to it and those rooms' shelving units.
#[typeshare]
#[derive(Debug, Serialize)]
pub struct FloorPlanDetailResponse {
    pub floor_plan: FloorPlanResponse,
    pub rooms: Vec<FloorPlanRoom>,
}

#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PlacementSuggestion {
    pub shelving_unit_id: Uuid,
    pub x_percent: f64,
    pub y_percent: f64,
    /// "high", "medium" or "low"
    pub confidence: String,
    pub reasoning: String,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct PlacementSuggestionsResponse {
    pub suggestions: Vec<PlacementSuggestion>,
}
