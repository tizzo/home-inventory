use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put},
    Router,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::middleware::auth::AuthUser;
use crate::models::{
    CreateFloorPlanRequest, FloorPlan, FloorPlanDetailResponse, FloorPlanResponse, FloorPlanRoom,
    FloorPlanUnit, FloorPlanUploadUrlRequest, PlacementSuggestionsResponse, PresignedUploadUrl,
    UnitPosition, UpdateFloorPlanRequest,
};
use crate::services::floor_plan::{
    floor_plan_extension, is_floor_plan_key, is_valid_percent, new_floor_plan_key,
    MAX_FLOOR_PLAN_BYTES, MAX_FLOOR_PLAN_DIMENSION,
};

const UPLOAD_URL_EXPIRES_SECS: i32 = 3600;

// ============================================================================
// Floor plans
// ============================================================================

/// Get a presigned URL for uploading a floor plan image
pub async fn get_floor_plan_upload_url(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Json(payload): Json<FloorPlanUploadUrlRequest>,
) -> Result<Json<PresignedUploadUrl>, StatusCode> {
    let extension = floor_plan_extension(&payload.content_type).ok_or_else(|| {
        tracing::warn!(
            "Unsupported floor plan content type: {}",
            payload.content_type
        );
        StatusCode::BAD_REQUEST
    })?;

    let s3_key = new_floor_plan_key(extension);
    let upload_url = state
        .s3
        .generate_presigned_upload_url_for_key(&s3_key, &payload.content_type)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate presigned URL: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(PresignedUploadUrl {
        upload_url,
        s3_key,
        expires_in: UPLOAD_URL_EXPIRES_SECS,
    }))
}

/// List all floor plans
pub async fn list_floor_plans(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
) -> Result<Json<Vec<FloorPlanResponse>>, StatusCode> {
    let floor_plans =
        sqlx::query_as::<_, FloorPlan>("SELECT * FROM floor_plans ORDER BY name, created_at")
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch floor plans: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let mut responses = Vec::with_capacity(floor_plans.len());
    for floor_plan in floor_plans {
        responses.push(build_response(&state, floor_plan).await?);
    }

    Ok(Json(responses))
}

/// Get a floor plan with its linked rooms, their shelving units and positions
pub async fn get_floor_plan(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<FloorPlanDetailResponse>, StatusCode> {
    let floor_plan = fetch_floor_plan(&state, id).await?;
    let rooms = fetch_rooms_with_units(&state, id).await?;
    let floor_plan = build_response(&state, floor_plan).await?;

    Ok(Json(FloorPlanDetailResponse { floor_plan, rooms }))
}

/// Create a floor plan record once the image has been uploaded
pub async fn create_floor_plan(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Json(payload): Json<CreateFloorPlanRequest>,
) -> Result<Json<FloorPlanResponse>, StatusCode> {
    let name = payload.name.trim();
    let dimensions = 1..=MAX_FLOOR_PLAN_DIMENSION;
    if name.is_empty()
        || name.chars().count() > 255
        || !dimensions.contains(&payload.width)
        || !dimensions.contains(&payload.height)
        || !is_floor_plan_key(&payload.s3_key, &payload.content_type)
    {
        tracing::warn!("Invalid floor plan request for key {}", payload.s3_key);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Trust the stored object, not the client, for whether and how much was uploaded
    let file_size = state
        .s3
        .object_size(&payload.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check uploaded floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or_else(|| {
            tracing::warn!("Floor plan {} was never uploaded", payload.s3_key);
            StatusCode::BAD_REQUEST
        })?;

    if file_size > MAX_FLOOR_PLAN_BYTES {
        state.s3.delete_file(&payload.s3_key).await.ok();
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }

    let description = payload
        .description
        .as_deref()
        .map(str::trim)
        .filter(|d| !d.is_empty());

    let floor_plan = sqlx::query_as::<_, FloorPlan>(
        r#"
        INSERT INTO floor_plans (id, name, description, s3_key, content_type, file_size, width, height, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(name)
    .bind(description)
    .bind(&payload.s3_key)
    .bind(&payload.content_type)
    .bind(file_size as i32)
    .bind(payload.width)
    .bind(payload.height)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create floor plan: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    state
        .audit
        .log_create("floor_plan", floor_plan.id, Some(user_id), None)
        .await
        .ok();

    Ok(Json(build_response(&state, floor_plan).await?))
}

/// Rename a floor plan or change its description
pub async fn update_floor_plan(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFloorPlanRequest>,
) -> Result<Json<FloorPlanResponse>, StatusCode> {
    let existing = fetch_floor_plan(&state, id).await?;

    let name = match payload.name.as_deref().map(str::trim) {
        Some(name) if name.is_empty() || name.chars().count() > 255 => {
            return Err(StatusCode::BAD_REQUEST);
        }
        Some(name) => name.to_string(),
        None => existing.name.clone(),
    };

    // An empty description clears it; a missing one leaves it alone
    let description = match payload.description.as_deref().map(str::trim) {
        Some("") => None,
        Some(description) => Some(description.to_string()),
        None => existing.description.clone(),
    };

    let mut changes = serde_json::Map::new();
    if name != existing.name {
        changes.insert(
            "name".to_string(),
            json!({ "from": &existing.name, "to": &name }),
        );
    }
    if description != existing.description {
        changes.insert(
            "description".to_string(),
            json!({ "from": &existing.description, "to": &description }),
        );
    }

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

    if !changes.is_empty() {
        state
            .audit
            .log_update(
                "floor_plan",
                id,
                Some(user_id),
                serde_json::Value::Object(changes),
                None,
            )
            .await
            .ok();
    }

    Ok(Json(build_response(&state, floor_plan).await?))
}

/// Delete a floor plan, unlinking its rooms and clearing their unit positions
pub async fn delete_floor_plan(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let floor_plan = fetch_floor_plan(&state, id).await?;

    // Each step is safe to repeat, so a failure part way through can be retried
    // by deleting again. The database row goes before the image so a storage
    // failure can never leave a floor plan that points at a missing file.
    sqlx::query(
        r#"
        DELETE FROM shelving_unit_positions
        WHERE shelving_unit_id IN (
            SELECT su.id
            FROM shelving_units su
            JOIN rooms r ON su.room_id = r.id
            WHERE r.floor_plan_id = $1
        )
        "#,
    )
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete floor plan positions: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    sqlx::query("UPDATE rooms SET floor_plan_id = NULL WHERE floor_plan_id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to unlink rooms from floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    sqlx::query("DELETE FROM floor_plans WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if let Err(e) = state.s3.delete_file(&floor_plan.s3_key).await {
        tracing::warn!(
            "Floor plan {} deleted but its image {} could not be removed: {:?}",
            id,
            floor_plan.s3_key,
            e
        );
    }

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
// Shelving unit positions
// ============================================================================

/// Place a shelving unit on a floor plan, or move it if it is already placed
pub async fn set_unit_position(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path((floor_plan_id, unit_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UnitPosition>,
) -> Result<Json<UnitPosition>, StatusCode> {
    if !is_valid_percent(payload.x_percent) || !is_valid_percent(payload.y_percent) {
        return Err(StatusCode::BAD_REQUEST);
    }

    fetch_floor_plan(&state, floor_plan_id).await?;

    if !unit_is_on_floor_plan(&state, unit_id, floor_plan_id).await? {
        tracing::warn!(
            "Unit {} is not in a room linked to floor plan {}",
            unit_id,
            floor_plan_id
        );
        return Err(StatusCode::BAD_REQUEST);
    }

    sqlx::query(
        r#"
        INSERT INTO shelving_unit_positions (shelving_unit_id, x_percent, y_percent, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (shelving_unit_id)
        DO UPDATE SET x_percent = $2, y_percent = $3, updated_at = NOW()
        "#,
    )
    .bind(unit_id)
    .bind(payload.x_percent)
    .bind(payload.y_percent)
    .bind(user_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to save unit position: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    state
        .audit
        .log_update(
            "shelving_unit",
            unit_id,
            Some(user_id),
            json!({ "floor_plan_position": { "to": payload } }),
            Some(json!({ "floor_plan_id": floor_plan_id })),
        )
        .await
        .ok();

    Ok(Json(payload))
}

/// Take a shelving unit off a floor plan
pub async fn delete_unit_position(
    State(state): State<Arc<AppState>>,
    AuthUser(user_id): AuthUser,
    Path((floor_plan_id, unit_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !unit_is_on_floor_plan(&state, unit_id, floor_plan_id).await? {
        return Err(StatusCode::NOT_FOUND);
    }

    let result = sqlx::query("DELETE FROM shelving_unit_positions WHERE shelving_unit_id = $1")
        .bind(unit_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete unit position: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    state
        .audit
        .log_update(
            "shelving_unit",
            unit_id,
            Some(user_id),
            json!({ "floor_plan_position": { "to": null } }),
            Some(json!({ "floor_plan_id": floor_plan_id })),
        )
        .await
        .ok();

    Ok(Json(json!({ "message": "Position removed successfully" })))
}

// ============================================================================
// AI-assisted placement
// ============================================================================

/// Ask the vision service where the unplaced shelving units belong
pub async fn suggest_placements(
    State(state): State<Arc<AppState>>,
    _user: AuthUser,
    Path(floor_plan_id): Path<Uuid>,
) -> Result<Json<PlacementSuggestionsResponse>, StatusCode> {
    let vision = state.vision.as_ref().ok_or_else(|| {
        tracing::error!("Vision service not available - ANTHROPIC_API_KEY not set");
        StatusCode::SERVICE_UNAVAILABLE
    })?;

    let floor_plan = fetch_floor_plan(&state, floor_plan_id).await?;
    let rooms = fetch_rooms_with_units(&state, floor_plan_id).await?;

    let has_unplaced_units = rooms
        .iter()
        .flat_map(|room| room.units.iter())
        .any(|unit| unit.position.is_none());
    if !has_unplaced_units {
        return Ok(Json(PlacementSuggestionsResponse {
            suggestions: vec![],
        }));
    }

    let image = state
        .s3
        .get_object_bytes(&floor_plan.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to download floor plan image: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let suggestions = vision
        .suggest_floor_plan_placements(&image, &floor_plan.content_type, &rooms)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get placement suggestions: {:?}", e);
            StatusCode::BAD_GATEWAY
        })?;

    Ok(Json(PlacementSuggestionsResponse { suggestions }))
}

// ============================================================================
// Helpers
// ============================================================================

async fn fetch_floor_plan(state: &AppState, id: Uuid) -> Result<FloorPlan, StatusCode> {
    sqlx::query_as::<_, FloorPlan>("SELECT * FROM floor_plans WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch floor plan: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)
}

async fn build_response(
    state: &AppState,
    floor_plan: FloorPlan,
) -> Result<FloorPlanResponse, StatusCode> {
    let url = state
        .s3
        .generate_presigned_download_url(&floor_plan.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate floor plan URL: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(FloorPlanResponse {
        id: floor_plan.id,
        name: floor_plan.name,
        description: floor_plan.description,
        url,
        content_type: floor_plan.content_type,
        file_size: floor_plan.file_size,
        width: floor_plan.width,
        height: floor_plan.height,
        created_at: floor_plan.created_at,
        updated_at: floor_plan.updated_at,
    })
}

/// A unit belongs on a floor plan when its room is linked to that plan
async fn unit_is_on_floor_plan(
    state: &AppState,
    unit_id: Uuid,
    floor_plan_id: Uuid,
) -> Result<bool, StatusCode> {
    let found = sqlx::query(
        r#"
        SELECT su.id
        FROM shelving_units su
        JOIN rooms r ON su.room_id = r.id
        WHERE su.id = $1 AND r.floor_plan_id = $2
        "#,
    )
    .bind(unit_id)
    .bind(floor_plan_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check shelving unit: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(found.is_some())
}

/// Rooms linked to a floor plan, each with its shelving units and positions
async fn fetch_rooms_with_units(
    state: &AppState,
    floor_plan_id: Uuid,
) -> Result<Vec<FloorPlanRoom>, StatusCode> {
    #[derive(sqlx::FromRow)]
    struct Row {
        room_id: Uuid,
        room_name: String,
        unit_id: Option<Uuid>,
        unit_name: Option<String>,
        unit_description: Option<String>,
        x_percent: Option<f64>,
        y_percent: Option<f64>,
    }

    let rows: Vec<Row> = sqlx::query_as(
        r#"
        SELECT
            r.id AS room_id,
            r.name AS room_name,
            su.id AS unit_id,
            su.name AS unit_name,
            su.description AS unit_description,
            p.x_percent,
            p.y_percent
        FROM rooms r
        LEFT JOIN shelving_units su ON su.room_id = r.id
        LEFT JOIN shelving_unit_positions p ON p.shelving_unit_id = su.id
        WHERE r.floor_plan_id = $1
        ORDER BY r.name, r.id, su.name, su.id
        "#,
    )
    .bind(floor_plan_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch floor plan rooms: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut rooms: Vec<FloorPlanRoom> = Vec::new();
    for row in rows {
        if rooms.last().map(|room| room.id) != Some(row.room_id) {
            rooms.push(FloorPlanRoom {
                id: row.room_id,
                name: row.room_name,
                units: Vec::new(),
            });
        }

        // A room with no shelving units still appears, with an empty list
        if let (Some(id), Some(name), Some(room)) = (row.unit_id, row.unit_name, rooms.last_mut()) {
            let position = match (row.x_percent, row.y_percent) {
                (Some(x_percent), Some(y_percent)) => Some(UnitPosition {
                    x_percent,
                    y_percent,
                }),
                _ => None,
            };
            room.units.push(FloorPlanUnit {
                id,
                name,
                description: row.unit_description,
                position,
            });
        }
    }

    Ok(rooms)
}

// ============================================================================
// Routes
// ============================================================================

pub fn floor_plan_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/floor-plans/upload-url",
            post(get_floor_plan_upload_url),
        )
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
            "/api/floor-plans/:id/positions/:unit_id",
            put(set_unit_position).delete(delete_unit_position),
        )
        .route(
            "/api/floor-plans/:id/suggest-placements",
            post(suggest_placements),
        )
}
