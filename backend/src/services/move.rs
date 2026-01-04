use axum::http::StatusCode;
use sqlx::PgPool;
use uuid::Uuid;

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

/// Move a container to a different location (shelf or parent container)
pub async fn move_container(
    db: &PgPool,
    container_id: Uuid,
    target_shelf_id: Option<Uuid>,
    target_parent_id: Option<Uuid>,
) -> Result<(), StatusCode> {
    // Validate location constraint
    match (target_shelf_id, target_parent_id) {
        (Some(sid), None) => {
            // Verify shelf exists
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

            // Prevent moving container to itself
            if container_id == sid {
                return Err(StatusCode::BAD_REQUEST);
            }

            sqlx::query(
                "UPDATE containers SET shelf_id = $1, parent_container_id = NULL, updated_at = NOW() WHERE id = $2"
            )
            .bind(sid)
            .bind(container_id)
            .execute(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to move container: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
        (None, Some(pid)) => {
            // Verify parent exists and prevent circular references
            if container_id == pid {
                return Err(StatusCode::BAD_REQUEST);
            }

            // Check for circular reference: ensure target parent is not a descendant
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
                "UPDATE containers SET shelf_id = NULL, parent_container_id = $1, updated_at = NOW() WHERE id = $2"
            )
            .bind(pid)
            .bind(container_id)
            .execute(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to move container: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
        _ => return Err(StatusCode::BAD_REQUEST),
    }

    Ok(())
}

/// Move an item to a different location (shelf or container)
pub async fn move_item(
    db: &PgPool,
    item_id: Uuid,
    target_shelf_id: Option<Uuid>,
    target_container_id: Option<Uuid>,
) -> Result<(), StatusCode> {
    // Validate location constraint
    match (target_shelf_id, target_container_id) {
        (Some(sid), None) => {
            // Verify shelf exists
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
                "UPDATE items SET shelf_id = $1, container_id = NULL, updated_at = NOW() WHERE id = $2"
            )
            .bind(sid)
            .bind(item_id)
            .execute(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to move item: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
        (None, Some(cid)) => {
            // Verify container exists
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
                "UPDATE items SET shelf_id = NULL, container_id = $1, updated_at = NOW() WHERE id = $2"
            )
            .bind(cid)
            .bind(item_id)
            .execute(db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to move item: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
        _ => return Err(StatusCode::BAD_REQUEST),
    }

    Ok(())
}
