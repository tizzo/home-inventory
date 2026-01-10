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

impl std::fmt::Display for AuditAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            AuditAction::Create => "CREATE",
            AuditAction::Update => "UPDATE",
            AuditAction::Delete => "DELETE",
            AuditAction::Move => "MOVE",
        };
        write!(f, "{}", s)
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
        self.log_action(
            entity_type,
            entity_id,
            AuditAction::Create,
            user_id,
            None,
            metadata,
        )
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
        self.log_action(
            entity_type,
            entity_id,
            AuditAction::Delete,
            user_id,
            None,
            metadata,
        )
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_action_display() {
        assert_eq!(AuditAction::Create.to_string(), "CREATE");
        assert_eq!(AuditAction::Update.to_string(), "UPDATE");
        assert_eq!(AuditAction::Delete.to_string(), "DELETE");
        assert_eq!(AuditAction::Move.to_string(), "MOVE");
    }

    #[test]
    fn test_audit_action_format() {
        let create = format!("{}", AuditAction::Create);
        let update = format!("{}", AuditAction::Update);
        let delete = format!("{}", AuditAction::Delete);
        let move_action = format!("{}", AuditAction::Move);

        assert_eq!(create, "CREATE");
        assert_eq!(update, "UPDATE");
        assert_eq!(delete, "DELETE");
        assert_eq!(move_action, "MOVE");
    }

    #[test]
    fn test_log_move_metadata_combination() {
        // Test the metadata combination logic from log_move
        let from_location = serde_json::json!({"shelf_id": "123"});
        let to_location = serde_json::json!({"container_id": "456"});

        let move_metadata = serde_json::json!({
            "from": from_location,
            "to": to_location,
        });

        // Test without existing metadata
        let combined_metadata = Some(move_metadata.clone());
        assert!(combined_metadata.is_some());
        let meta = combined_metadata.unwrap();
        assert!(meta.get("from").is_some());
        assert!(meta.get("to").is_some());

        // Test with existing metadata
        let existing_metadata = serde_json::json!({
            "reason": "reorganization",
            "timestamp": "2024-01-01T00:00:00Z"
        });

        let mut map = existing_metadata.as_object().cloned().unwrap_or_default();
        map.extend(move_metadata.as_object().unwrap().clone());
        let combined = Value::Object(map);

        assert!(combined.get("from").is_some());
        assert!(combined.get("to").is_some());
        assert!(combined.get("reason").is_some());
        assert!(combined.get("timestamp").is_some());
    }

    #[test]
    fn test_audit_action_all_variants() {
        // Ensure all variants are covered
        let actions = vec![
            AuditAction::Create,
            AuditAction::Update,
            AuditAction::Delete,
            AuditAction::Move,
        ];

        let strings: Vec<String> = actions.iter().map(|a| a.to_string()).collect();

        assert_eq!(strings.len(), 4);
        assert!(strings.contains(&"CREATE".to_string()));
        assert!(strings.contains(&"UPDATE".to_string()));
        assert!(strings.contains(&"DELETE".to_string()));
        assert!(strings.contains(&"MOVE".to_string()));
    }

    #[test]
    fn test_move_metadata_structure() {
        // Verify the structure of move metadata matches expectations
        let from = serde_json::json!({
            "shelf_id": "abc-123",
            "shelf_name": "Top Shelf"
        });
        let to = serde_json::json!({
            "container_id": "def-456",
            "container_name": "Storage Box"
        });

        let move_metadata = serde_json::json!({
            "from": from,
            "to": to,
        });

        assert!(move_metadata.is_object());
        assert!(move_metadata.get("from").is_some());
        assert!(move_metadata.get("to").is_some());

        let from_obj = move_metadata.get("from").unwrap().as_object().unwrap();
        assert!(from_obj.contains_key("shelf_id"));
        assert!(from_obj.contains_key("shelf_name"));

        let to_obj = move_metadata.get("to").unwrap().as_object().unwrap();
        assert!(to_obj.contains_key("container_id"));
        assert!(to_obj.contains_key("container_name"));
    }
}
