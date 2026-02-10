use axum::http::StatusCode;
use sqlx::PgPool;
use uuid::Uuid;

/// Move a shelving unit to a different room
pub async fn move_shelving_unit(
    db: &PgPool,
    unit_id: Uuid,
    target_room_id: Uuid,
) -> Result<(), StatusCode> {
    // Verify target room exists
    let room_exists = sqlx::query("SELECT id FROM rooms WHERE id = $1")
        .bind(target_room_id)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify room: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .is_some();

    if !room_exists {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Update shelving unit's room_id
    sqlx::query("UPDATE shelving_units SET room_id = $1, updated_at = NOW() WHERE id = $2")
        .bind(target_room_id)
        .bind(unit_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move shelving unit: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(())
}

/// Move a shelf to a different shelving unit
pub async fn move_shelf(
    db: &PgPool,
    shelf_id: Uuid,
    target_unit_id: Uuid,
) -> Result<(), StatusCode> {
    // Verify target unit exists
    let unit_exists = sqlx::query("SELECT id FROM shelving_units WHERE id = $1")
        .bind(target_unit_id)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify shelving unit: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .is_some();

    if !unit_exists {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Update shelf's shelving_unit_id
    sqlx::query("UPDATE shelves SET shelving_unit_id = $1, updated_at = NOW() WHERE id = $2")
        .bind(target_unit_id)
        .bind(shelf_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move shelf: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(())
}

/// Move a container to a different location (shelf, parent container, room, or unplaced)
pub async fn move_container(
    db: &PgPool,
    container_id: Uuid,
    target_shelf_id: Option<Uuid>,
    target_parent_id: Option<Uuid>,
    target_room_id: Option<Uuid>,
) -> Result<(), StatusCode> {
    // Validate: at most one target
    let location_count = [
        target_shelf_id.is_some(),
        target_parent_id.is_some(),
        target_room_id.is_some(),
    ]
    .iter()
    .filter(|&&x| x)
    .count();
    if location_count > 1 {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(sid) = target_shelf_id {
        let shelf_exists = sqlx::query("SELECT id FROM shelves WHERE id = $1")
            .bind(sid)
            .fetch_optional(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify shelf: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();
        if !shelf_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
        if container_id == sid {
            return Err(StatusCode::BAD_REQUEST);
        }
        sqlx::query(
            "UPDATE containers SET shelf_id = $1, parent_container_id = NULL, room_id = NULL, updated_at = NOW() WHERE id = $2"
        )
        .bind(sid)
        .bind(container_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move container: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    } else if let Some(pid) = target_parent_id {
        if container_id == pid {
            return Err(StatusCode::BAD_REQUEST);
        }
        let is_descendant: bool = sqlx::query_scalar(
            r#"
            WITH RECURSIVE descendants AS (
                SELECT id, parent_container_id FROM containers WHERE id = $1
                UNION ALL
                SELECT c.id, c.parent_container_id
                FROM containers c
                INNER JOIN descendants d ON c.parent_container_id = d.id
            )
            SELECT EXISTS(SELECT 1 FROM descendants WHERE id = $2)
            "#,
        )
        .bind(container_id)
        .bind(pid)
        .fetch_one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check circular reference: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        if is_descendant {
            return Err(StatusCode::BAD_REQUEST);
        }
        let parent_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
            .bind(pid)
            .fetch_optional(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify parent container: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();
        if !parent_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
        sqlx::query(
            "UPDATE containers SET shelf_id = NULL, parent_container_id = $1, room_id = NULL, updated_at = NOW() WHERE id = $2"
        )
        .bind(pid)
        .bind(container_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move container: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    } else if let Some(rid) = target_room_id {
        let room_exists = sqlx::query("SELECT id FROM rooms WHERE id = $1")
            .bind(rid)
            .fetch_optional(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify room: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();
        if !room_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
        sqlx::query(
            "UPDATE containers SET shelf_id = NULL, parent_container_id = NULL, room_id = $1, updated_at = NOW() WHERE id = $2"
        )
        .bind(rid)
        .bind(container_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move container: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    } else {
        // Move to unplaced
        sqlx::query(
            "UPDATE containers SET shelf_id = NULL, parent_container_id = NULL, room_id = NULL, updated_at = NOW() WHERE id = $1"
        )
        .bind(container_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move container: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    Ok(())
}

/// Move an item to a different location (shelf, container, room, or unplaced)
pub async fn move_item(
    db: &PgPool,
    item_id: Uuid,
    target_shelf_id: Option<Uuid>,
    target_container_id: Option<Uuid>,
    target_room_id: Option<Uuid>,
) -> Result<(), StatusCode> {
    let location_count = [
        target_shelf_id.is_some(),
        target_container_id.is_some(),
        target_room_id.is_some(),
    ]
    .iter()
    .filter(|&&x| x)
    .count();
    if location_count > 1 {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(sid) = target_shelf_id {
        let shelf_exists = sqlx::query("SELECT id FROM shelves WHERE id = $1")
            .bind(sid)
            .fetch_optional(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify shelf: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();
        if !shelf_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
        sqlx::query(
            "UPDATE items SET shelf_id = $1, container_id = NULL, room_id = NULL, updated_at = NOW() WHERE id = $2"
        )
        .bind(sid)
        .bind(item_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move item: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    } else if let Some(cid) = target_container_id {
        let container_exists = sqlx::query("SELECT id FROM containers WHERE id = $1")
            .bind(cid)
            .fetch_optional(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify container: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();
        if !container_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
        sqlx::query(
            "UPDATE items SET shelf_id = NULL, container_id = $1, room_id = NULL, updated_at = NOW() WHERE id = $2"
        )
        .bind(cid)
        .bind(item_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move item: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    } else if let Some(rid) = target_room_id {
        let room_exists = sqlx::query("SELECT id FROM rooms WHERE id = $1")
            .bind(rid)
            .fetch_optional(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify room: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .is_some();
        if !room_exists {
            return Err(StatusCode::BAD_REQUEST);
        }
        sqlx::query(
            "UPDATE items SET shelf_id = NULL, container_id = NULL, room_id = $1, updated_at = NOW() WHERE id = $2"
        )
        .bind(rid)
        .bind(item_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move item: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    } else {
        // Move to unplaced
        sqlx::query(
            "UPDATE items SET shelf_id = NULL, container_id = NULL, room_id = NULL, updated_at = NOW() WHERE id = $1"
        )
        .bind(item_id)
        .execute(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to move item: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    Ok(())
}
