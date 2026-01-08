use axum::{
    async_trait,
    extract::{FromRequestParts, Request},
    http::{request::Parts, StatusCode},
    middleware::Next,
    response::Response,
};
use tower_sessions::Session;
use uuid::Uuid;

use crate::routes::auth::UserSession;

pub async fn auth_guard(
    session: Session,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let user: Option<UserSession> = session
        .get("user")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if user.is_some() {
        Ok(next.run(request).await)
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

/// Extractor for authenticated user ID
pub struct AuthUser(pub Uuid);

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let session = Session::from_request_parts(parts, state)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let user: Option<UserSession> = session
            .get("user")
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        match user {
            Some(u) => Ok(AuthUser(u.user_id)),
            None => Err(StatusCode::UNAUTHORIZED),
        }
    }
}
