use crate::app::AppState;
use crate::models::allowed_email::{AllowedEmail, AllowedEmailResponse, CreateAllowedEmailRequest};
use crate::routes::auth::UserSession;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use std::sync::Arc;
use tower_sessions::Session;
use uuid::Uuid;

pub fn allowed_email_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/allowed-emails", get(list_allowed_emails))
        .route("/api/allowed-emails", post(add_allowed_email))
        .route("/api/allowed-emails/:id", delete(remove_allowed_email))
}

async fn list_allowed_emails(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AllowedEmailResponse>>, StatusCode> {
    let emails = sqlx::query_as::<_, AllowedEmail>(
        "SELECT id, email, added_by, created_at FROM allowed_emails ORDER BY created_at ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list allowed emails: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(emails.into_iter().map(Into::into).collect()))
}

async fn add_allowed_email(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<CreateAllowedEmailRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let user: UserSession = session
        .get("user")
        .await
        .unwrap_or(None)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let email = body.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, AllowedEmail>(
        r#"
        INSERT INTO allowed_emails (id, email, added_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, added_by, created_at
        "#,
    )
    .bind(id)
    .bind(&email)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to add allowed email: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match row {
        Some(ae) => Ok((StatusCode::CREATED, Json(AllowedEmailResponse::from(ae)))),
        None => Err(StatusCode::CONFLICT),
    }
}

async fn remove_allowed_email(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM allowed_emails WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to remove allowed email: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        Err(StatusCode::NOT_FOUND)
    } else {
        Ok(StatusCode::NO_CONTENT)
    }
}

/// Seed allowed emails from ALLOWED_EMAILS env var on startup
pub async fn seed_allowed_emails(pool: &sqlx::PgPool) {
    let emails_str = match std::env::var("ALLOWED_EMAILS") {
        Ok(s) if !s.is_empty() => s,
        _ => return,
    };

    for email in emails_str.split(',') {
        let email = email.trim().to_lowercase();
        if email.is_empty() {
            continue;
        }
        let id = Uuid::new_v4();
        match sqlx::query(
            "INSERT INTO allowed_emails (id, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING",
        )
        .bind(id)
        .bind(&email)
        .execute(pool)
        .await
        {
            Ok(_) => tracing::info!("Allowed email seeded: {}", email),
            Err(e) => tracing::warn!("Failed to seed allowed email {}: {:?}", email, e),
        }
    }
}

/// Count the number of emails currently in the allowlist.
///
/// The `::int` cast (and `i32` return) are required for Aurora DSQL, which
/// returns INT4 for `COUNT(*)` where PostgreSQL returns INT8. Decoding it as
/// `i64` triggers a type-decode error at runtime (see commit that fixed the
/// "Database error" on login). Do not change this to `i64`.
pub async fn count_allowed_emails(pool: &sqlx::PgPool) -> Result<i32, sqlx::Error> {
    let count: (i32,) = sqlx::query_as("SELECT COUNT(*)::int FROM allowed_emails")
        .fetch_one(pool)
        .await?;
    Ok(count.0)
}

/// Check if an email is in the allowlist. Returns true if allowed.
/// Fails closed: an empty allowlist admits no one. A bootstrap user must be
/// configured via `ALLOWED_EMAILS` (see `seed_allowed_emails`) before anyone
/// can log in.
pub async fn is_email_allowed(pool: &sqlx::PgPool, email: &str) -> Result<bool, sqlx::Error> {
    let exists: Option<(i32,)> = sqlx::query_as("SELECT 1 FROM allowed_emails WHERE email = $1")
        .bind(email.to_lowercase())
        .fetch_optional(pool)
        .await?;

    Ok(exists.is_some())
}
