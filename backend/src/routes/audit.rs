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
use crate::models::audit::AuditLogResponse;
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;
use sqlx::FromRow;

// Extended audit log with user name from join
#[derive(Debug, FromRow)]
struct AuditLogWithUser {
    pub id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub action: String,
    pub user_id: Option<Uuid>,
    pub changes: Option<JsonValue>,
    pub metadata: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub user_name: Option<String>,
}

impl From<AuditLogWithUser> for AuditLogResponse {
    fn from(log: AuditLogWithUser) -> Self {
        Self {
            id: log.id.to_string(),
            entity_type: log.entity_type,
            entity_id: log.entity_id.to_string(),
            action: log.action,
            user_id: log.user_id.map(|u| u.to_string()),
            user_name: log.user_name,
            changes: log.changes,
            metadata: log.metadata,
            created_at: log.created_at.to_rfc3339(),
        }
    }
}

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

    if let Some(ref _entity_type) = params.entity_type {
        query.push_str(&format!(" AND entity_type = ${}", bind_count));
        bind_count += 1;
    }
    if let Some(_entity_id) = params.entity_id {
        query.push_str(&format!(" AND entity_id = ${}", bind_count));
        bind_count += 1;
    }
    if let Some(_user_id) = params.user_id {
        query.push_str(&format!(" AND user_id = ${}", bind_count));
        bind_count += 1;
    }
    if let Some(ref _action) = params.action {
        query.push_str(&format!(" AND action = ${}", bind_count));
        bind_count += 1;
    }

    query.push_str(" ORDER BY created_at DESC");
    query.push_str(&format!(
        " LIMIT ${} OFFSET ${}",
        bind_count,
        bind_count + 1
    ));

    // Query with user name join
    let logs = sqlx::query_as::<_, AuditLogWithUser>(
        r#"
        SELECT 
            al.*,
            u.name as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
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
    let logs = sqlx::query_as::<_, AuditLogWithUser>(
        r#"
        SELECT 
            al.*,
            u.name as user_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.entity_type = $1 AND al.entity_id = $2
        ORDER BY al.created_at DESC
        "#,
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
        .route(
            "/api/audit/entity/:entity_type/:entity_id",
            get(get_audit_logs_by_entity),
        )
}
