use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use tower_sessions::Session;

use crate::routes::auth::UserSession;

pub async fn auth_guard(
    session: Session,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let user: Option<UserSession> = session.get("user").await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if user.is_some() {
        Ok(next.run(request).await)
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}
