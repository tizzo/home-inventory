use crate::app::AppState;
use axum::http::StatusCode;
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

pub enum AuditAction {
    Create,
    Update,
    Delete,
    Move,
}

impl ToString for AuditAction {
    fn to_string(&self) -> String {
        match self {
            AuditAction::Create => "CREATE".to_string(),
            AuditAction::Update => "UPDATE".to_string(),
            AuditAction::Delete => "DELETE".to_string(),
            AuditAction::Move => "MOVE".to_string(),
        }
    }
}

pub struct AuditService {
    db: Arc<PgPool>,
}

impl AuditService {
    pub fn new(db: Arc<PgPool>) -> Self {
        Self { db }
    }

    /// Log an action for an entity
    pub async fn log_action(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        action: AuditAction,
        user_id: Option<Uuid>,
        changes: Option<Value>,
        metadata: Option<Value>,
    ) -> Result<(), StatusCode> {
        sqlx::query(
            r#"
            INSERT INTO audit_logs (id, entity_type, entity_id, action, user_id, changes, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(entity_type)
        .bind(entity_id)
        .bind(action.to_string())
        .bind(user_id)
        .bind(changes)
        .bind(metadata)
        .execute(&*self.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to log audit action: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        Ok(())
    }

    /// Log a create action
    pub async fn log_create(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        user_id: Option<Uuid>,
        metadata: Option<Value>,
    ) -> Result<(), StatusCode> {
        self.log_action(entity_type, entity_id, AuditAction::Create, user_id, None, metadata)
            .await
    }

    /// Log an update action with changes
    pub async fn log_update(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        user_id: Option<Uuid>,
        changes: Value,
        metadata: Option<Value>,
    ) -> Result<(), StatusCode> {
        self.log_action(
            entity_type,
            entity_id,
            AuditAction::Update,
            user_id,
            Some(changes),
            metadata,
        )
        .await
    }

    /// Log a delete action
    pub async fn log_delete(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        user_id: Option<Uuid>,
        metadata: Option<Value>,
    ) -> Result<(), StatusCode> {
        self.log_action(entity_type, entity_id, AuditAction::Delete, user_id, None, metadata)
            .await
    }

    /// Log a move action
    pub async fn log_move(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        user_id: Option<Uuid>,
        from_location: Value,
        to_location: Value,
        metadata: Option<Value>,
    ) -> Result<(), StatusCode> {
        let move_metadata = serde_json::json!({
            "from": from_location,
            "to": to_location,
        });
        
        let combined_metadata = if let Some(meta) = metadata {
            let mut map = meta.as_object().cloned().unwrap_or_default();
            map.extend(move_metadata.as_object().unwrap().clone());
            Some(Value::Object(map))
        } else {
            Some(move_metadata)
        };

        self.log_action(
            entity_type,
            entity_id,
            AuditAction::Move,
            user_id,
            None,
            combined_metadata,
        )
        .await
    }
}
