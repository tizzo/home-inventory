use aws_sdk_s3::{presigning::PresigningConfig, Client as S3Client};
use std::env;
use std::time::Duration;
use uuid::Uuid;

pub struct S3Service {
    client: S3Client,
    bucket: String,
    #[allow(dead_code)]
    endpoint_url: Option<String>,
}

impl S3Service {
    pub async fn new() -> anyhow::Result<Self> {
        let bucket = env::var("S3_BUCKET").unwrap_or_else(|_| "home-inventory-photos".to_string());
        let endpoint_url = env::var("S3_ENDPOINT").ok();
        let region = env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());

        // Get credentials - support both S3_* and AWS_* env vars
        let access_key = env::var("S3_ACCESS_KEY")
            .or_else(|_| env::var("AWS_ACCESS_KEY_ID"))
            .unwrap_or_else(|_| "minioadmin".to_string());
        let secret_key = env::var("S3_SECRET_KEY")
            .or_else(|_| env::var("AWS_SECRET_ACCESS_KEY"))
            .unwrap_or_else(|_| "minioadmin".to_string());

        tracing::info!(
            "Initializing S3 service with bucket: {}, endpoint: {:?}",
            bucket,
            endpoint_url
        );

        let client = if let Some(endpoint) = &endpoint_url {
            // For MinIO/local S3, configure with custom endpoint and credentials
            tracing::info!("Using MinIO endpoint: {}", endpoint);
            let credentials =
                aws_sdk_s3::config::Credentials::new(&access_key, &secret_key, None, None, "minio");

            // MinIO requires path-style URLs (not virtual-hosted-style)
            let s3_config = aws_sdk_s3::Config::builder()
                .behavior_version(aws_sdk_s3::config::BehaviorVersion::latest())
                .endpoint_url(endpoint)
                .region(aws_config::Region::new(region))
                .credentials_provider(credentials)
                .force_path_style(true) // Critical for MinIO compatibility
                .build();

            S3Client::from_conf(s3_config)
        } else {
            // For AWS S3, use standard config
            let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
                .load()
                .await;
            S3Client::new(&config)
        };

        // Verify bucket exists (should be created by minio-init container)
        // We don't create it here - that's handled by infrastructure
        match client.head_bucket().bucket(&bucket).send().await {
            Ok(_) => {
                tracing::info!("✅ S3 bucket '{}' verified", bucket);
            }
            Err(e) => {
                tracing::warn!("Bucket '{}' not found: {:?}", bucket, e);
                tracing::warn!("Bucket should be created by minio-init container");
                tracing::warn!("If running outside docker-compose, create bucket manually");
                // Don't fail here - let operations fail naturally if bucket doesn't exist
                // This allows the app to start even if bucket isn't ready yet
            }
        }

        Ok(Self {
            client,
            bucket,
            endpoint_url,
        })
    }

    /// Generate a presigned URL for uploading a file
    pub async fn generate_presigned_upload_url(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        content_type: &str,
    ) -> anyhow::Result<(String, String)> {
        // Generate unique S3 key
        let file_id = Uuid::new_v4();
        let extension = match content_type {
            ct if ct.starts_with("image/jpeg") => "jpg",
            ct if ct.starts_with("image/png") => "png",
            ct if ct.starts_with("image/webp") => "webp",
            ct if ct.starts_with("image/gif") => "gif",
            _ => "bin",
        };
        let s3_key = format!("{}/{}/{}.{}", entity_type, entity_id, file_id, extension);

        tracing::debug!(
            "Generating presigned URL for bucket: {}, key: {}",
            self.bucket,
            s3_key
        );

        // Generate presigned URL (valid for 1 hour)
        let presigning_config = PresigningConfig::expires_in(Duration::from_secs(3600))?;

        let presigned_request = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(&s3_key)
            .content_type(content_type)
            .presigned(presigning_config)
            .await?;

        let upload_url = presigned_request.uri().to_string();

        tracing::debug!("Generated presigned URL: {}", upload_url);
        tracing::debug!("Bucket: {}, Key: {}", self.bucket, s3_key);

        Ok((upload_url, s3_key))
    }

    /// Generate a presigned URL for downloading/viewing a file
    pub async fn generate_presigned_download_url(&self, s3_key: &str) -> anyhow::Result<String> {
        let presigning_config = PresigningConfig::expires_in(Duration::from_secs(86400))?;

        let presigned_request = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(s3_key)
            .presigned(presigning_config)
            .await?;

        Ok(presigned_request.uri().to_string())
    }

    /// Delete a file from S3
    pub async fn delete_file(&self, s3_key: &str) -> anyhow::Result<()> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(s3_key)
            .send()
            .await?;

        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_bucket(&self) -> &str {
        &self.bucket
    }

    #[allow(dead_code)]
    pub fn get_endpoint(&self) -> Option<&str> {
        self.endpoint_url.as_deref()
    }
}
