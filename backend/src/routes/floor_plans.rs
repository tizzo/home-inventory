use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use rust_decimal::prelude::ToPrimitive;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::middleware::auth::AuthUser;
use crate::models::{
    CreateFloorPlanRequest, CreatePositionRequest, FloorPlan, FloorPlanResponse,
    FloorPlanWithPositionsResponse, LinkedRoomInfo, PlacementSuggestionsResponse, PositionResponse,
    PresignedUploadUrl, RoomWithUnits, ShelvingUnitPosition, UnitInfo, UpdateFloorPlanRequest,
    UpdatePositionRequest,
};

// ============================================================================
// Upload URL Request
// ============================================================================

#[derive(Deserialize)]
pub struct UploadUrlRequest {
    content_type: String,
}

// ============================================================================
// Floor Plan CRUD
// ============================================================================

/// Get presigned URL for uploading a floor plan
pub async fn get_upload_url(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UploadUrlRequest>,
) -> Result<Json<PresignedUploadUrl>, StatusCode> {
    let floor_plan_id = Uuid::new_v4();

    let (upload_url, s3_key) = state
        .s3
        .generate_presigned_upload_url("floor-plan", floor_plan_id, &payload.content_type)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate presigned URL: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(PresignedUploadUrl {
        upload_url,
        s3_key,
        expires_in: 3600,
    }))
}

/// List all floor plans
pub async fn list_floor_plans(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<FloorPlanResponse>>, StatusCode> {
    let floor_plans =
        sqlx::query_as::<_, FloorPlan>("SELECT * FROM floor_plans ORDER BY created_at DESC")
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch floor plans: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let mut responses = Vec::new();
    for fp in floor_plans {
        let response = build_floor_plan_response(&state, fp).await?;
        responses.push(response);
    }

    Ok(Json(responses))
}

/// Get a single floor plan with all positions and linked rooms
pub async fn get_floor_plan(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<FloorPlanWithPositionsResponse>, StatusCode> {
    let floor_plan = sqlx::query_as::<_, FloorPlan>("SELECT * FROM floor_plans WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let floor_plan_response = build_floor_plan_response(&state, floor_plan).await?;

    // Get positions with unit and room names
    let positions = get_positions_for_floor_plan(&state, id).await?;

    // Get linked rooms with shelving unit counts
    let linked_rooms = get_linked_rooms(&state, id).await?;

    Ok(Json(FloorPlanWithPositionsResponse {
        floor_plan: floor_plan_response,
        positions,
        linked_rooms,
    }))
}

/// Create a floor plan record after successful S3 upload
pub async fn create_floor_plan(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<CreateFloorPlanRequest>,
) -> Result<Json<FloorPlanResponse>, StatusCode> {
    let floor_plan = sqlx::query_as::<_, FloorPlan>(
        r#"
        INSERT INTO floor_plans (id, name, description, s3_key, thumbnail_s3_key, content_type, file_size, width, height, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.s3_key)
    .bind(&payload.thumbnail_s3_key)
    .bind(&payload.content_type)
    .bind(payload.file_size)
    .bind(payload.width)
    .bind(payload.height)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create floor plan: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    state
        .audit
        .log_create("floor_plan", floor_plan.id, Some(user_id), None)
        .await
        .ok();

    let response = build_floor_plan_response(&state, floor_plan).await?;
    Ok(Json(response))
}

/// Update a floor plan
pub async fn update_floor_plan(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFloorPlanRequest>,
) -> Result<Json<FloorPlanResponse>, StatusCode> {
    let existing = sqlx::query_as::<_, FloorPlan>("SELECT * FROM floor_plans WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let name = payload.name.unwrap_or(existing.name);
    let description = payload.description.or(existing.description);

    let floor_plan = sqlx::query_as::<_, FloorPlan>(
        r#"
        UPDATE floor_plans
        SET name = $1, description = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update floor plan: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Log audit
    state
        .audit
        .log_update("floor_plan", id, Some(user_id), json!({}), None)
        .await
        .ok();

    let response = build_floor_plan_response(&state, floor_plan).await?;
    Ok(Json(response))
}

/// Delete a floor plan
pub async fn delete_floor_plan(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let floor_plan = sqlx::query_as::<_, FloorPlan>("SELECT * FROM floor_plans WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Clear floor_plan_id from any linked rooms
    sqlx::query("UPDATE rooms SET floor_plan_id = NULL WHERE floor_plan_id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to unlink rooms: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Delete all positions for this floor plan
    sqlx::query("DELETE FROM shelving_unit_positions WHERE floor_plan_id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete positions: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Delete from S3
    state
        .s3
        .delete_file(&floor_plan.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete file from S3: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if let Some(ref thumb_key) = floor_plan.thumbnail_s3_key {
        state.s3.delete_file(thumb_key).await.ok();
    }

    // Delete from database
    sqlx::query("DELETE FROM floor_plans WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Log audit
    state
        .audit
        .log_delete("floor_plan", id, Some(user_id), None)
        .await
        .ok();

    Ok(Json(
        json!({ "message": "Floor plan deleted successfully" }),
    ))
}

// ============================================================================
// Position CRUD
// ============================================================================

/// Get all positions for a floor plan
pub async fn list_positions(
    State(state): State<Arc<AppState>>,
    Path(floor_plan_id): Path<Uuid>,
) -> Result<Json<Vec<PositionResponse>>, StatusCode> {
    // Verify floor plan exists
    let _ = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM floor_plans WHERE id = $1")
        .bind(floor_plan_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let positions = get_positions_for_floor_plan(&state, floor_plan_id).await?;
    Ok(Json(positions))
}

/// Add a position for a shelving unit on a floor plan
pub async fn create_position(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(floor_plan_id): Path<Uuid>,
    Json(payload): Json<CreatePositionRequest>,
) -> Result<Json<PositionResponse>, StatusCode> {
    let shelving_unit_id = Uuid::parse_str(&payload.shelving_unit_id).map_err(|_| {
        tracing::error!("Invalid shelving_unit_id");
        StatusCode::BAD_REQUEST
    })?;

    // Verify floor plan exists
    let _ = sqlx::query_as::<_, FloorPlan>("SELECT * FROM floor_plans WHERE id = $1")
        .bind(floor_plan_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Verify shelving unit exists and is in a room linked to this floor plan
    let unit_room: Option<(Uuid, String, String)> = sqlx::query_as(
        r#"
        SELECT su.id, su.name, r.name as room_name
        FROM shelving_units su
        JOIN rooms r ON su.room_id = r.id
        WHERE su.id = $1 AND r.floor_plan_id = $2
        "#,
    )
    .bind(shelving_unit_id)
    .bind(floor_plan_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to verify shelving unit: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let (_, unit_name, room_name) = unit_room.ok_or_else(|| {
        tracing::error!("Shelving unit not found or not in a room linked to this floor plan");
        StatusCode::BAD_REQUEST
    })?;

    let rotation = payload.rotation_degrees.unwrap_or(0);

    let position = sqlx::query_as::<_, ShelvingUnitPosition>(
        r#"
        INSERT INTO shelving_unit_positions (id, floor_plan_id, shelving_unit_id, x_percent, y_percent, rotation_degrees, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(floor_plan_id)
    .bind(shelving_unit_id)
    .bind(rust_decimal::Decimal::try_from(payload.x_percent).unwrap_or_default())
    .bind(rust_decimal::Decimal::try_from(payload.y_percent).unwrap_or_default())
    .bind(rotation)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create position: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(PositionResponse {
        id: position.id.to_string(),
        floor_plan_id: position.floor_plan_id.to_string(),
        shelving_unit_id: position.shelving_unit_id.to_string(),
        shelving_unit_name: unit_name,
        room_name,
        x_percent: position.x_percent.to_f64().unwrap_or(0.0),
        y_percent: position.y_percent.to_f64().unwrap_or(0.0),
        rotation_degrees: position.rotation_degrees,
    }))
}

/// Update a position (e.g., after dragging)
pub async fn update_position(
    State(state): State<Arc<AppState>>,
    AuthUser(_user_id): AuthUser,
    Path((floor_plan_id, position_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdatePositionRequest>,
) -> Result<Json<PositionResponse>, StatusCode> {
    let existing = sqlx::query_as::<_, ShelvingUnitPosition>(
        "SELECT * FROM shelving_unit_positions WHERE id = $1 AND floor_plan_id = $2",
    )
    .bind(position_id)
    .bind(floor_plan_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch position: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let x_percent = payload
        .x_percent
        .map(|x| rust_decimal::Decimal::try_from(x).unwrap_or_default())
        .unwrap_or(existing.x_percent);
    let y_percent = payload
        .y_percent
        .map(|y| rust_decimal::Decimal::try_from(y).unwrap_or_default())
        .unwrap_or(existing.y_percent);
    let rotation = payload
        .rotation_degrees
        .unwrap_or(existing.rotation_degrees);

    let position = sqlx::query_as::<_, ShelvingUnitPosition>(
        r#"
        UPDATE shelving_unit_positions
        SET x_percent = $1, y_percent = $2, rotation_degrees = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
        "#,
    )
    .bind(x_percent)
    .bind(y_percent)
    .bind(rotation)
    .bind(position_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update position: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Get unit and room names
    let (unit_name, room_name): (String, String) = sqlx::query_as(
        r#"
        SELECT su.name, r.name
        FROM shelving_units su
        JOIN rooms r ON su.room_id = r.id
        WHERE su.id = $1
        "#,
    )
    .bind(position.shelving_unit_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get unit/room names: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(PositionResponse {
        id: position.id.to_string(),
        floor_plan_id: position.floor_plan_id.to_string(),
        shelving_unit_id: position.shelving_unit_id.to_string(),
        shelving_unit_name: unit_name,
        room_name,
        x_percent: position.x_percent.to_f64().unwrap_or(0.0),
        y_percent: position.y_percent.to_f64().unwrap_or(0.0),
        rotation_degrees: position.rotation_degrees,
    }))
}

/// Delete a position
pub async fn delete_position(
    State(state): State<Arc<AppState>>,
    AuthUser(_user_id): AuthUser,
    Path((floor_plan_id, position_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let result =
        sqlx::query("DELETE FROM shelving_unit_positions WHERE id = $1 AND floor_plan_id = $2")
            .bind(position_id)
            .bind(floor_plan_id)
            .execute(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to delete position: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({ "message": "Position deleted successfully" })))
}

// ============================================================================
// AI-Assisted Placement
// ============================================================================

/// Get AI-suggested placements for shelving units
pub async fn suggest_placements(
    State(state): State<Arc<AppState>>,
    Path(floor_plan_id): Path<Uuid>,
) -> Result<Json<PlacementSuggestionsResponse>, StatusCode> {
    // Check if vision service is available
    let vision = state.vision.as_ref().ok_or_else(|| {
        tracing::error!("Vision service not available - ANTHROPIC_API_KEY not set");
        StatusCode::SERVICE_UNAVAILABLE
    })?;

    // Get floor plan
    let floor_plan = sqlx::query_as::<_, FloorPlan>("SELECT * FROM floor_plans WHERE id = $1")
        .bind(floor_plan_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Get rooms linked to this floor plan with their shelving units
    let rooms_with_units = get_rooms_with_units(&state, floor_plan_id).await?;

    if rooms_with_units.is_empty() {
        return Ok(Json(PlacementSuggestionsResponse {
            suggestions: vec![],
        }));
    }

    // Get already-placed unit IDs to exclude from suggestions
    let placed_unit_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT shelving_unit_id FROM shelving_unit_positions WHERE floor_plan_id = $1",
    )
    .bind(floor_plan_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch placed units: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Filter out already-placed units
    let unplaced_rooms: Vec<RoomWithUnits> = rooms_with_units
        .into_iter()
        .map(|room| RoomWithUnits {
            room_name: room.room_name,
            units: room
                .units
                .into_iter()
                .filter(|u| !placed_unit_ids.contains(&u.id))
                .collect(),
        })
        .filter(|room| !room.units.is_empty())
        .collect();

    if unplaced_rooms.is_empty() {
        return Ok(Json(PlacementSuggestionsResponse {
            suggestions: vec![],
        }));
    }

    // Download floor plan image from S3
    let image_bytes = state
        .s3
        .get_object_bytes(&floor_plan.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to download floor plan from S3: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Call vision service for placement suggestions
    let suggestions = vision
        .analyze_floor_plan_for_placements(&image_bytes, &floor_plan.content_type, &unplaced_rooms)
        .await
        .map_err(|e| {
            tracing::error!("Failed to analyze floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(PlacementSuggestionsResponse { suggestions }))
}

// ============================================================================
// Helper Functions
// ============================================================================

async fn build_floor_plan_response(
    state: &AppState,
    floor_plan: FloorPlan,
) -> Result<FloorPlanResponse, StatusCode> {
    let url = state
        .s3
        .generate_presigned_download_url(&floor_plan.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate download URL: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let thumbnail_url = if let Some(ref thumb_key) = floor_plan.thumbnail_s3_key {
        Some(
            state
                .s3
                .generate_presigned_download_url(thumb_key)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to generate thumbnail URL: {:?}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?,
        )
    } else {
        None
    };

    Ok(FloorPlanResponse {
        id: floor_plan.id.to_string(),
        name: floor_plan.name,
        description: floor_plan.description,
        url,
        thumbnail_url,
        content_type: floor_plan.content_type,
        file_size: floor_plan.file_size,
        width: floor_plan.width,
        height: floor_plan.height,
        created_at: floor_plan.created_at.to_rfc3339(),
        updated_at: floor_plan.updated_at.to_rfc3339(),
    })
}

async fn get_positions_for_floor_plan(
    state: &AppState,
    floor_plan_id: Uuid,
) -> Result<Vec<PositionResponse>, StatusCode> {
    #[derive(sqlx::FromRow)]
    struct PositionWithNames {
        id: Uuid,
        floor_plan_id: Uuid,
        shelving_unit_id: Uuid,
        x_percent: rust_decimal::Decimal,
        y_percent: rust_decimal::Decimal,
        rotation_degrees: i32,
        shelving_unit_name: String,
        room_name: String,
    }

    let positions: Vec<PositionWithNames> = sqlx::query_as(
        r#"
        SELECT
            sup.id, sup.floor_plan_id, sup.shelving_unit_id,
            sup.x_percent, sup.y_percent, sup.rotation_degrees,
            su.name as shelving_unit_name,
            r.name as room_name
        FROM shelving_unit_positions sup
        JOIN shelving_units su ON sup.shelving_unit_id = su.id
        JOIN rooms r ON su.room_id = r.id
        WHERE sup.floor_plan_id = $1
        ORDER BY r.name, su.name
        "#,
    )
    .bind(floor_plan_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch positions: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(positions
        .into_iter()
        .map(|p| PositionResponse {
            id: p.id.to_string(),
            floor_plan_id: p.floor_plan_id.to_string(),
            shelving_unit_id: p.shelving_unit_id.to_string(),
            shelving_unit_name: p.shelving_unit_name,
            room_name: p.room_name,
            x_percent: p.x_percent.to_f64().unwrap_or(0.0),
            y_percent: p.y_percent.to_f64().unwrap_or(0.0),
            rotation_degrees: p.rotation_degrees,
        })
        .collect())
}

async fn get_linked_rooms(
    state: &AppState,
    floor_plan_id: Uuid,
) -> Result<Vec<LinkedRoomInfo>, StatusCode> {
    #[derive(sqlx::FromRow)]
    struct RoomInfo {
        id: Uuid,
        name: String,
        unit_count: i64,
    }

    let rooms: Vec<RoomInfo> = sqlx::query_as(
        r#"
        SELECT r.id, r.name, COUNT(su.id) as unit_count
        FROM rooms r
        LEFT JOIN shelving_units su ON su.room_id = r.id
        WHERE r.floor_plan_id = $1
        GROUP BY r.id, r.name
        ORDER BY r.name
        "#,
    )
    .bind(floor_plan_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch linked rooms: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(rooms
        .into_iter()
        .map(|r| LinkedRoomInfo {
            id: r.id.to_string(),
            name: r.name,
            shelving_unit_count: r.unit_count as i32,
        })
        .collect())
}

async fn get_rooms_with_units(
    state: &AppState,
    floor_plan_id: Uuid,
) -> Result<Vec<RoomWithUnits>, StatusCode> {
    #[derive(sqlx::FromRow)]
    struct UnitRow {
        room_name: String,
        unit_id: Uuid,
        unit_name: String,
        unit_description: Option<String>,
    }

    let rows: Vec<UnitRow> = sqlx::query_as(
        r#"
        SELECT r.name as room_name, su.id as unit_id, su.name as unit_name, su.description as unit_description
        FROM rooms r
        JOIN shelving_units su ON su.room_id = r.id
        WHERE r.floor_plan_id = $1
        ORDER BY r.name, su.name
        "#,
    )
    .bind(floor_plan_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch rooms with units: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Group by room
    let mut rooms: Vec<RoomWithUnits> = Vec::new();
    let mut current_room: Option<RoomWithUnits> = None;

    for row in rows {
        match &mut current_room {
            Some(room) if room.room_name == row.room_name => {
                room.units.push(UnitInfo {
                    id: row.unit_id,
                    name: row.unit_name,
                    description: row.unit_description,
                });
            }
            _ => {
                if let Some(room) = current_room.take() {
                    rooms.push(room);
                }
                current_room = Some(RoomWithUnits {
                    room_name: row.room_name,
                    units: vec![UnitInfo {
                        id: row.unit_id,
                        name: row.unit_name,
                        description: row.unit_description,
                    }],
                });
            }
        }
    }

    if let Some(room) = current_room {
        rooms.push(room);
    }

    Ok(rooms)
}

// ============================================================================
// Routes
// ============================================================================

pub fn floor_plan_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/floor-plans/upload-url", post(get_upload_url))
        .route(
            "/api/floor-plans",
            get(list_floor_plans).post(create_floor_plan),
        )
        .route(
            "/api/floor-plans/:id",
            get(get_floor_plan)
                .put(update_floor_plan)
                .delete(delete_floor_plan),
        )
        .route(
            "/api/floor-plans/:floor_plan_id/positions",
            get(list_positions).post(create_position),
        )
        .route(
            "/api/floor-plans/:floor_plan_id/positions/:position_id",
            axum::routing::put(update_position).delete(delete_position),
        )
        .route(
            "/api/floor-plans/:floor_plan_id/suggest-placements",
            post(suggest_placements),
        )
}
