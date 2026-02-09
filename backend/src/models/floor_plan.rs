use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use typeshare::typeshare;
use uuid::Uuid;

// ============================================================================
// Floor Plan Models
// ============================================================================

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FloorPlan {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub s3_key: String,
    pub thumbnail_s3_key: Option<String>,
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
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub content_type: String,
    pub file_size: i32,
    pub width: i32,
    pub height: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreateFloorPlanRequest {
    pub name: String,
    pub description: Option<String>,
    pub s3_key: String,
    pub thumbnail_s3_key: Option<String>,
    pub content_type: String,
    pub file_size: i32,
    pub width: i32,
    pub height: i32,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct UpdateFloorPlanRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

// ============================================================================
// Shelving Unit Position Models
// ============================================================================

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShelvingUnitPosition {
    pub id: Uuid,
    pub floor_plan_id: Uuid,
    pub shelving_unit_id: Uuid,
    pub x_percent: Decimal,
    pub y_percent: Decimal,
    pub rotation_degrees: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Uuid,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct PositionResponse {
    pub id: String,
    pub floor_plan_id: String,
    pub shelving_unit_id: String,
    pub shelving_unit_name: String,
    pub room_name: String,
    pub x_percent: f64,
    pub y_percent: f64,
    pub rotation_degrees: i32,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct CreatePositionRequest {
    pub shelving_unit_id: String,
    pub x_percent: f64,
    pub y_percent: f64,
    pub rotation_degrees: Option<i32>,
}

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct UpdatePositionRequest {
    pub x_percent: Option<f64>,
    pub y_percent: Option<f64>,
    pub rotation_degrees: Option<i32>,
}

// ============================================================================
// Combined Response Models
// ============================================================================

#[typeshare]
#[derive(Debug, Serialize)]
pub struct FloorPlanWithPositionsResponse {
    pub floor_plan: FloorPlanResponse,
    pub positions: Vec<PositionResponse>,
    pub linked_rooms: Vec<LinkedRoomInfo>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct LinkedRoomInfo {
    pub id: String,
    pub name: String,
    pub shelving_unit_count: i32,
}

// ============================================================================
// AI Placement Suggestion Models
// ============================================================================

#[typeshare]
#[derive(Debug, Serialize, Deserialize)]
pub struct PlacementSuggestion {
    pub shelving_unit_id: String,
    pub shelving_unit_name: String,
    pub room_name: String,
    pub x_percent: f64,
    pub y_percent: f64,
    pub confidence: String,
    pub reasoning: String,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct PlacementSuggestionsResponse {
    pub suggestions: Vec<PlacementSuggestion>,
}

// ============================================================================
// Helper for unit info during AI analysis
// ============================================================================

#[derive(Debug, Clone)]
pub struct RoomWithUnits {
    pub room_name: String,
    pub units: Vec<UnitInfo>,
}

#[derive(Debug, Clone)]
pub struct UnitInfo {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
}
