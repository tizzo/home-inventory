use axum::{
    extract::{Query, State},
    response::{Redirect, IntoResponse},
    routing::{get, post},
    Json, Router,
    http::StatusCode,
};
use oauth2::{
    reqwest::async_http_client, AuthorizationCode, CsrfToken, Scope, TokenResponse,
};
use serde::{Deserialize, Serialize};
use tower_sessions::Session;
use std::sync::Arc;
use crate::app::AppState;

const AUTH_URL: &str = "https://www.googleapis.com/oauth2/v2/userinfo";

#[derive(Debug, Deserialize)]
struct AuthRequest {
    code: String,
    state: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct GoogleUser {
    id: String,
    email: String,
    name: String,
    picture: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSession {
    pub user_id: uuid::Uuid,
    pub email: String,
    pub name: String,
}

pub fn auth_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/auth/login", get(login_handler))
        .route("/api/auth/callback", get(auth_callback))
        .route("/api/auth/me", get(get_me_handler))
        .route("/api/auth/logout", post(logout_handler))
}


async fn login_handler(
    State(state): State<Arc<AppState>>,
    session: Session,
) -> impl IntoResponse {
    let (auth_url, csrf_token) = state
        .oauth_client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("email".to_string()))
        .add_scope(Scope::new("profile".to_string()))
        .url();

    // Store the csrf_token in the session to verify later
    session.insert("csrf_token", csrf_token.secret().clone()).await.expect("Failed to insert csrf_token");

    Redirect::to(auth_url.as_str())
}

async fn auth_callback(
    Query(query): Query<AuthRequest>,
    State(state): State<Arc<AppState>>,
    session: Session,
) -> impl IntoResponse {
    // Verify CSRF token
    let stored_token: Option<String> = session.get("csrf_token").await.unwrap_or(None);
    if stored_token.is_none() || stored_token.unwrap() != query.state {
        return (StatusCode::BAD_REQUEST, "Invalid CSRF token").into_response();
    }

    // Exchange the code with a token
    let token = match state
        .oauth_client
        .exchange_code(AuthorizationCode::new(query.code.clone()))
        .request_async(async_http_client)
        .await
    {
        Ok(token) => token,
        Err(e) => {
            tracing::error!("Failed to exchange token: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to exchange token").into_response();
        }
    };

    // Use the token to get the user info
    let client = reqwest::Client::new();
    let google_user: GoogleUser = match client
        .get(AUTH_URL)
        .bearer_auth(token.access_token().secret())
        .send()
        .await
    {
        Ok(res) => match res.json::<GoogleUser>().await {
            Ok(user) => user,
            Err(e) => {
                tracing::error!("Failed to parse user info: {:?}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to parse user info").into_response();
            }
        },
        Err(e) => {
            tracing::error!("Failed to get user info: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get user info").into_response();
        }
    };

    // Upsert user in database
    // Function to ensure user exists
    let user_id = match upsert_user(&state.db, &google_user).await {
        Ok(id) => id,
        Err(e) => {
            tracing::error!("Database error: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
        }
    };

    // Create session
    let user_session = UserSession {
        user_id,
        email: google_user.email,
        name: google_user.name,
    };
    session.insert("user", user_session).await.expect("Failed to create session");

    // Redirect to frontend
    Redirect::to(&state.app_base_url)
        .into_response()
}

async fn get_me_handler(session: Session) -> impl IntoResponse {
    let user: Option<UserSession> = session.get("user").await.unwrap_or(None);
    match user {
        Some(u) => Json(u).into_response(),
        None => (StatusCode::UNAUTHORIZED, "Not logged in").into_response(),
    }
}

async fn logout_handler(session: Session) -> impl IntoResponse {
    session.flush().await.ok();
    StatusCode::OK
}

async fn upsert_user(pool: &sqlx::PgPool, google_user: &GoogleUser) -> anyhow::Result<uuid::Uuid> {
    let new_user_id = uuid::Uuid::new_v4();
    let row = sqlx::query!(
        r#"
        INSERT INTO users (id, email, name, google_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (google_id)
        DO UPDATE SET name = $3, email = $2, updated_at = NOW()
        RETURNING id
        "#,
        new_user_id,
        google_user.email,
        google_user.name,
        google_user.id
    )
    .fetch_one(pool)
    .await?;

    Ok(row.id)
}

