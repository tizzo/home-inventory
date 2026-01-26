use axum::{
    extract::{ConnectInfo, Query, State},
    http::StatusCode,
    response::Json,
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::models::{
    ContactSubmission, ContactSubmissionResponse, CreateContactSubmissionRequest,
    PaginatedResponse, PaginationQuery,
};

/// Create a new contact submission (public endpoint with reCAPTCHA)
pub async fn create_contact_submission(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<CreateContactSubmissionRequest>,
) -> Result<Json<ContactSubmissionResponse>, StatusCode> {
    // Verify reCAPTCHA token
    state
        .captcha
        .verify_token(&payload.recaptcha_token)
        .await
        .map_err(|e| {
            tracing::warn!("reCAPTCHA verification failed: {:?}", e);
            StatusCode::BAD_REQUEST
        })?;

    // Extract user agent from headers
    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Validate email format (basic check)
    if !payload.email.contains('@') {
        tracing::warn!("Invalid email format: {}", payload.email);
        return Err(StatusCode::BAD_REQUEST);
    }

    // If item_id is provided, verify it exists
    if let Some(item_id) = payload.item_id {
        let item_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM items WHERE id = $1)")
            .bind(item_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to check item existence: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        if !item_exists {
            tracing::warn!("Item not found: {}", item_id);
            return Err(StatusCode::NOT_FOUND);
        }
    }

    // Create contact submission
    let submission = sqlx::query_as::<_, ContactSubmission>(
        r#"
        INSERT INTO contact_submissions (id, name, email, subject, message, item_id, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&payload.name)
    .bind(&payload.email)
    .bind(&payload.subject)
    .bind(&payload.message)
    .bind(payload.item_id)
    .bind(addr.ip().to_string())
    .bind(user_agent)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create contact submission: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(
        "Contact submission created: {} from {} ({})",
        submission.id,
        submission.email,
        submission.name
    );

    Ok(Json(ContactSubmissionResponse::from(submission)))
}

/// List all contact submissions (protected endpoint)
pub async fn list_contact_submissions(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PaginationQuery>,
) -> Result<Json<PaginatedResponse<ContactSubmissionResponse>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 1000);
    let offset = params.offset.unwrap_or(0).max(0);

    // Get total count
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM contact_submissions")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count contact submissions: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total = total.clamp(0, i32::MAX as i64) as i32;

    // Get paginated submissions
    let submissions = sqlx::query_as::<_, ContactSubmission>(
        "SELECT * FROM contact_submissions ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch contact submissions: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let responses: Vec<ContactSubmissionResponse> = submissions
        .into_iter()
        .map(ContactSubmissionResponse::from)
        .collect();

    Ok(Json(PaginatedResponse::new(
        responses, total, limit, offset,
    )))
}

/// Create contact routes
/// Note: POST /api/contact is public (no auth), GET /api/contact is protected
pub fn contact_routes() -> Router<Arc<AppState>> {
    use axum::routing::{get, post};

    Router::new()
        .route("/api/contact", post(create_contact_submission))
        .route("/api/contact", get(list_contact_submissions))
}
