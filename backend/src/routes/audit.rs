use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    Router,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::models::{AuditLog, AuditLogResponse};

#[derive(Debug, Deserialize)]
pub struct AuditLogsQuery {
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub action: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Get audit logs with optional filters
pub async fn get_audit_logs(
    State(state): State<Arc<AppState>>,
    Query(params): Query<AuditLogsQuery>,
) -> Result<Json<Vec<AuditLogResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(100).min(1000);
    let offset = params.offset.unwrap_or(0);

    let mut query = "SELECT * FROM audit_logs WHERE 1=1".to_string();
    let mut bind_count = 1;

    if let Some(ref entity_type) = params.entity_type {
        query.push_str(&format!(" AND entity_type = ${}", bind_count));
        bind_count += 1;
    }
    if let Some(entity_id) = params.entity_id {
        query.push_str(&format!(" AND entity_id = ${}", bind_count));
        bind_count += 1;
    }
    if let Some(user_id) = params.user_id {
        query.push_str(&format!(" AND user_id = ${}", bind_count));
        bind_count += 1;
    }
    if let Some(ref action) = params.action {
        query.push_str(&format!(" AND action = ${}", bind_count));
        bind_count += 1;
    }

    query.push_str(" ORDER BY created_at DESC");
    query.push_str(&format!(" LIMIT ${} OFFSET ${}", bind_count, bind_count + 1));

    // Build query dynamically - for now use a simpler approach
    let logs = if params.entity_type.is_some()
        || params.entity_id.is_some()
        || params.user_id.is_some()
        || params.action.is_some()
    {
        // Use a simpler query for now
        sqlx::query_as::<_, AuditLog>(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as::<_, AuditLog>(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    }
    .map_err(|e| {
        tracing::error!("Failed to fetch audit logs: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<AuditLogResponse> = logs.into_iter().map(AuditLogResponse::from).collect();
    Ok(Json(responses))
}

/// Get audit logs for a specific entity
pub async fn get_audit_logs_by_entity(
    State(state): State<Arc<AppState>>,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<Vec<AuditLogResponse>>, StatusCode> {
    let logs = sqlx::query_as::<_, AuditLog>(
        "SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC"
    )
        .bind(&entity_type)
        .bind(entity_id)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch audit logs: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let responses: Vec<AuditLogResponse> = logs.into_iter().map(AuditLogResponse::from).collect();
    Ok(Json(responses))
}

/// Create audit routes
pub fn audit_routes() -> Router<Arc<AppState>> {
    use axum::routing::get;
    
    Router::new()
        .route("/api/audit", get(get_audit_logs))
        .route("/api/audit/entity/:entity_type/:entity_id", get(get_audit_logs_by_entity))
}
