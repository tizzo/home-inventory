use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::models::{CreatePhotoRequest, Photo, PhotoResponse, PresignedUploadUrl};

#[derive(Deserialize)]
pub struct GetPhotosQuery {
    entity_type: String,
    entity_id: String,
}

#[derive(Deserialize)]
pub struct UploadUrlRequest {
    content_type: String,
}

/// Get presigned URL for uploading a photo
pub async fn get_upload_url(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetPhotosQuery>,
    Json(payload): Json<UploadUrlRequest>,
) -> Result<Json<PresignedUploadUrl>, StatusCode> {
    let entity_id = Uuid::parse_str(&params.entity_id).map_err(|_| {
        tracing::error!("Invalid entity_id: {}", params.entity_id);
        StatusCode::BAD_REQUEST
    })?;

    let content_type = &payload.content_type;

    let (upload_url, s3_key) = state
        .s3
        .generate_presigned_upload_url(&params.entity_type, entity_id, content_type)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate presigned URL: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(PresignedUploadUrl {
        upload_url,
        s3_key,
        expires_in: 3600, // 1 hour
    }))
}

/// Get all photos for an entity
pub async fn get_photos(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetPhotosQuery>,
) -> Result<Json<Vec<PhotoResponse>>, StatusCode> {
    let entity_id = Uuid::parse_str(&params.entity_id).map_err(|_| {
        tracing::error!("Invalid entity_id: {}", params.entity_id);
        StatusCode::BAD_REQUEST
    })?;

    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC",
    )
    .bind(&params.entity_type)
    .bind(entity_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch photos: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Generate presigned URLs for each photo
    let mut responses = Vec::new();
    for photo in photos {
        let url = state
            .s3
            .generate_presigned_download_url(&photo.s3_key)
            .await
            .map_err(|e| {
                tracing::error!("Failed to generate download URL: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        let thumbnail_url = if let Some(ref thumb_key) = photo.thumbnail_s3_key {
            Some(
                state
                    .s3
                    .generate_presigned_download_url(thumb_key)
                    .await
                    .map_err(|e| {
                        tracing::error!("Failed to generate thumbnail URL: {:?}", e);
                        StatusCode::INTERNAL_SERVER_ERROR
                    })?,
            )
        } else {
            None
        };

        let mut response: PhotoResponse = photo.into();
        response.url = url;
        response.thumbnail_url = thumbnail_url;
        responses.push(response);
    }

    Ok(Json(responses))
}

/// Create photo record after upload
pub async fn create_photo(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreatePhotoRequest>,
) -> Result<Json<PhotoResponse>, StatusCode> {
    // For now, use a hardcoded user ID (we'll implement auth later)
    let user_id = Uuid::new_v4();
    let entity_id = Uuid::parse_str(&payload.entity_id).map_err(|_| {
        tracing::error!("Invalid entity_id: {}", payload.entity_id);
        StatusCode::BAD_REQUEST
    })?;

    let photo = sqlx::query_as::<_, Photo>(
        r#"
        INSERT INTO photos (id, entity_type, entity_id, s3_key, thumbnail_s3_key, content_type, file_size, width, height, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&payload.entity_type)
    .bind(entity_id)
    .bind(&payload.s3_key)
    .bind(&payload.thumbnail_s3_key)
    .bind(&payload.content_type)
    .bind(payload.file_size)
    .bind(payload.width)
    .bind(payload.height)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create photo: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Generate presigned URLs
    let url = state
        .s3
        .generate_presigned_download_url(&photo.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate download URL: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let thumbnail_url = if let Some(ref thumb_key) = photo.thumbnail_s3_key {
        Some(
            state
                .s3
                .generate_presigned_download_url(thumb_key)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to generate thumbnail URL: {:?}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?,
        )
    } else {
        None
    };

    let mut response: PhotoResponse = photo.into();
    response.url = url;
    response.thumbnail_url = thumbnail_url;

    Ok(Json(response))
}

/// Delete a photo
pub async fn delete_photo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Get photo to find S3 keys
    let photo = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch photo: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Delete from S3
    state.s3.delete_file(&photo.s3_key).await.map_err(|e| {
        tracing::error!("Failed to delete file from S3: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Some(ref thumb_key) = photo.thumbnail_s3_key {
        state.s3.delete_file(thumb_key).await.ok(); // Ignore errors for thumbnails
    }

    // Delete from database
    let result = sqlx::query("DELETE FROM photos WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete photo: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(
        serde_json::json!({ "message": "Photo deleted successfully" }),
    ))
}

/// Get a single photo by ID
pub async fn get_photo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<PhotoResponse>, StatusCode> {
    let photo = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch photo: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Generate presigned URL
    let url = state
        .s3
        .generate_presigned_download_url(&photo.s3_key)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate presigned URL: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let thumbnail_url = if let Some(thumbnail_key) = &photo.thumbnail_s3_key {
        Some(
            state
                .s3
                .generate_presigned_download_url(thumbnail_key)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to generate thumbnail presigned URL: {:?}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?,
        )
    } else {
        None
    };

    Ok(Json(PhotoResponse {
        id: photo.id.to_string(),
        entity_type: photo.entity_type,
        entity_id: photo.entity_id.to_string(),
        url,
        thumbnail_url,
        content_type: photo.content_type,
        file_size: photo.file_size,
        width: photo.width,
        height: photo.height,
        created_at: photo.created_at.to_rfc3339(),
    }))
}

/// Create photo routes
pub fn photo_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/photos/upload-url", post(get_upload_url))
        .route("/api/photos", get(get_photos).post(create_photo))
        .route("/api/photos/:id", get(get_photo).delete(delete_photo))
}
