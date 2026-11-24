//! Shared rules for floor plans and shelving unit positions.
//!
//! A shelving unit has at most one position, and it is always on the floor plan
//! its room is linked to. Whenever that link changes (the unit moves rooms, the
//! room is relinked, or either is deleted) the position is cleared, so a stored
//! position can never point at the wrong floor plan.

use sqlx::PgPool;
use uuid::Uuid;

/// Largest floor plan image accepted. The AI placement request sends the image
/// base64-encoded, and the Anthropic API allows 10 MB per encoded image.
pub const MAX_FLOOR_PLAN_BYTES: i64 = 7 * 1024 * 1024;

/// Largest width or height accepted, matching the Anthropic API image limit.
pub const MAX_FLOOR_PLAN_DIMENSION: i32 = 8000;

/// File extension for an allowed floor plan content type.
pub fn floor_plan_extension(content_type: &str) -> Option<&'static str> {
    match content_type {
        "image/png" => Some("png"),
        "image/jpeg" => Some("jpg"),
        "image/webp" => Some("webp"),
        _ => None,
    }
}

/// Build the storage key for a new floor plan upload.
pub fn new_floor_plan_key(extension: &str) -> String {
    format!("floor-plans/{}.{}", Uuid::new_v4(), extension)
}

/// Check that a key was produced by [`new_floor_plan_key`] for this content
/// type, so clients cannot register (and later delete) arbitrary objects.
pub fn is_floor_plan_key(s3_key: &str, content_type: &str) -> bool {
    let Some(extension) = floor_plan_extension(content_type) else {
        return false;
    };
    s3_key
        .strip_prefix("floor-plans/")
        .and_then(|rest| rest.strip_suffix(extension))
        .and_then(|rest| rest.strip_suffix('.'))
        .is_some_and(|id| Uuid::parse_str(id).is_ok())
}

/// A position coordinate must be a real number between 0 and 100.
pub fn is_valid_percent(value: f64) -> bool {
    value.is_finite() && (0.0..=100.0).contains(&value)
}

/// Remove a shelving unit's position. Failures are logged, not returned, so
/// they never block the delete or move that triggered the cleanup.
pub async fn clear_unit_position(db: &PgPool, shelving_unit_id: Uuid) {
    if let Err(e) = sqlx::query("DELETE FROM shelving_unit_positions WHERE shelving_unit_id = $1")
        .bind(shelving_unit_id)
        .execute(db)
        .await
    {
        tracing::warn!(
            "Failed to clear floor plan position for unit {}: {:?}",
            shelving_unit_id,
            e
        );
    }
}

/// Remove the positions of every shelving unit in a room.
pub async fn clear_room_positions(db: &PgPool, room_id: Uuid) {
    if let Err(e) = sqlx::query(
        r#"
        DELETE FROM shelving_unit_positions
        WHERE shelving_unit_id IN (SELECT id FROM shelving_units WHERE room_id = $1)
        "#,
    )
    .bind(room_id)
    .execute(db)
    .await
    {
        tracing::warn!(
            "Failed to clear floor plan positions for room {}: {:?}",
            room_id,
            e
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_floor_plan_extension_allowlist() {
        assert_eq!(floor_plan_extension("image/png"), Some("png"));
        assert_eq!(floor_plan_extension("image/jpeg"), Some("jpg"));
        assert_eq!(floor_plan_extension("image/webp"), Some("webp"));
        assert_eq!(floor_plan_extension("image/heic"), None);
        assert_eq!(floor_plan_extension("application/pdf"), None);
    }

    #[test]
    fn test_generated_keys_are_accepted() {
        let key = new_floor_plan_key("png");
        assert!(is_floor_plan_key(&key, "image/png"));
    }

    #[test]
    fn test_foreign_keys_are_rejected() {
        let id = Uuid::new_v4();
        // Another entity's object
        assert!(!is_floor_plan_key(
            &format!("room/{}/{}.png", id, id),
            "image/png"
        ));
        // Extension does not match the content type
        assert!(!is_floor_plan_key(
            &format!("floor-plans/{}.png", id),
            "image/jpeg"
        ));
        // Not a generated id
        assert!(!is_floor_plan_key("floor-plans/../secret.png", "image/png"));
        assert!(!is_floor_plan_key("floor-plans/.png", "image/png"));
        // Unsupported type
        assert!(!is_floor_plan_key(
            &format!("floor-plans/{}.gif", id),
            "image/gif"
        ));
    }

    #[test]
    fn test_is_valid_percent() {
        assert!(is_valid_percent(0.0));
        assert!(is_valid_percent(42.5));
        assert!(is_valid_percent(100.0));
        assert!(!is_valid_percent(-0.1));
        assert!(!is_valid_percent(100.1));
        assert!(!is_valid_percent(f64::NAN));
        assert!(!is_valid_percent(f64::INFINITY));
    }
}
