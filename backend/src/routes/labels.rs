use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{AppendHeaders, Response},
    Router,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::app::AppState;
use crate::models::label::*;
use crate::services::generate_label_pdf;

/// Generate a batch of labels
pub async fn generate_labels(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<GenerateLabelsRequest>,
) -> Result<axum::Json<GenerateLabelsResponse>, StatusCode> {
    // Validate count
    if payload.count <= 0 || payload.count > 1000 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Use default template if not specified
    let template = payload.template.as_deref().unwrap_or("avery_18660");
    if template != "avery_18660" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Generate batch ID
    let batch_id = Uuid::new_v4();

    // Get the next label number
    // Use COALESCE to return 0 when there are no labels yet
    let max_number: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(number), 0) FROM labels")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get max label number: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let start_number = max_number + 1;

    // Generate labels
    let mut labels = Vec::new();
    for i in 0..payload.count {
        let label_id = Uuid::new_v4();
        let number = start_number + i;
        // QR data will be a URL to the label using the configured base URL
        // Ensure base URL doesn't have trailing slash
        let base_url = state.app_base_url.trim_end_matches('/');
        let qr_data = format!("{}/l/{}", base_url, label_id);

        let label = sqlx::query_as::<_, Label>(
            r#"
            INSERT INTO labels (id, number, qr_data, batch_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(label_id)
        .bind(number)
        .bind(&qr_data)
        .bind(batch_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create label: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        labels.push(label);
    }

    let response = GenerateLabelsResponse {
        batch_id,
        labels: labels.into_iter().map(LabelResponse::from).collect(),
        count: payload.count,
    };

    Ok(axum::Json(response))
}

/// Get a single label by ID
pub async fn get_label(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<axum::Json<LabelResponse>, StatusCode> {
    let label = sqlx::query_as::<_, Label>("SELECT * FROM labels WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch label: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(axum::Json(LabelResponse::from(label)))
}

/// Assign a label to an entity
pub async fn assign_label(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    axum::Json(payload): axum::Json<AssignLabelRequest>,
) -> Result<axum::Json<LabelResponse>, StatusCode> {
    // Validate assigned_to_type
    let valid_types = ["room", "unit", "shelf", "container", "item"];
    if !valid_types.contains(&payload.assigned_to_type.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Check if label exists
    let _existing = sqlx::query_as::<_, Label>("SELECT * FROM labels WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch label: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Update label assignment
    let label = sqlx::query_as::<_, Label>(
        r#"
        UPDATE labels
        SET assigned_to_type = $1, assigned_to_id = $2, assigned_at = NOW()
        WHERE id = $3
        RETURNING *
        "#,
    )
    .bind(&payload.assigned_to_type)
    .bind(payload.assigned_to_id)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to assign label: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(axum::Json(LabelResponse::from(label)))
}

#[derive(Deserialize)]
pub struct PrintQuery {
    template: Option<String>,
}

/// Generate PDF for a batch of labels
pub async fn print_labels(
    State(state): State<Arc<AppState>>,
    Path(batch_id): Path<Uuid>,
    Query(query): Query<PrintQuery>,
) -> Result<Response, StatusCode> {
    // Get all labels in the batch
    let labels =
        sqlx::query_as::<_, Label>("SELECT * FROM labels WHERE batch_id = $1 ORDER BY number ASC")
            .bind(batch_id)
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch labels: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if labels.is_empty() {
        return Err(StatusCode::NOT_FOUND);
    }

    // Use default template if not specified
    let template = query.template.as_deref().unwrap_or("avery_18660");
    if template != "avery_18660" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Prepare label data for PDF generation
    let label_data: Vec<(String, i32)> = labels
        .iter()
        .map(|l| (l.qr_data.clone(), l.number))
        .collect();

    // Generate PDF
    let pdf_bytes = generate_label_pdf(&label_data).map_err(|e| {
        tracing::error!("Failed to generate PDF: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Return PDF response
    let _headers = AppendHeaders([
        (header::CONTENT_TYPE, "application/pdf"),
        (
            header::CONTENT_DISPOSITION,
            &format!("attachment; filename=\"labels-{}.pdf\"", batch_id),
        ),
    ]);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"labels-{}.pdf\"", batch_id),
        )
        .body(axum::body::Body::from(pdf_bytes))
        .unwrap())
}

/// Create label routes
pub fn label_routes() -> Router<Arc<AppState>> {
    use axum::routing::{get, post};

    Router::new()
        .route("/api/labels/generate", post(generate_labels))
        .route("/api/labels/:id", get(get_label))
        .route("/api/labels/:id/assign", post(assign_label))
        .route("/api/labels/print/:batchId", get(print_labels))
}
