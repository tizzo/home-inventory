use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct CaptchaService {
    secret_key: String,
    verification_url: String,
    threshold: f64,
}

#[derive(Debug, Serialize)]
struct VerifyRequest {
    secret: String,
    response: String,
}

#[derive(Debug, Deserialize)]
struct VerifyResponse {
    success: bool,
    score: Option<f64>,
    #[serde(rename = "error-codes")]
    error_codes: Option<Vec<String>>,
}

#[derive(Debug)]
pub enum CaptchaError {
    RequestFailed(String),
    InvalidToken,
    LowScore(f64),
}

impl std::fmt::Display for CaptchaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptchaError::RequestFailed(msg) => write!(f, "Captcha verification failed: {}", msg),
            CaptchaError::InvalidToken => write!(f, "Invalid reCAPTCHA token"),
            CaptchaError::LowScore(score) => {
                write!(f, "reCAPTCHA score too low: {:.2}", score)
            }
        }
    }
}

impl std::error::Error for CaptchaError {}

impl CaptchaService {
    pub fn new(secret_key: String, threshold: f64) -> Arc<Self> {
        Arc::new(Self {
            secret_key,
            verification_url: "https://www.google.com/recaptcha/api/siteverify".to_string(),
            threshold,
        })
    }

    /// Verify a reCAPTCHA token and check if the score meets the threshold
    /// Returns Ok(score) if verification succeeds and score >= threshold
    pub async fn verify_token(&self, token: &str) -> Result<f64, CaptchaError> {
        let client = reqwest::Client::new();

        let params = VerifyRequest {
            secret: self.secret_key.clone(),
            response: token.to_string(),
        };

        let response = client
            .post(&self.verification_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| CaptchaError::RequestFailed(e.to_string()))?;

        let verify_response: VerifyResponse = response
            .json()
            .await
            .map_err(|e| CaptchaError::RequestFailed(e.to_string()))?;

        if !verify_response.success {
            let error_msg = verify_response
                .error_codes
                .map(|codes| codes.join(", "))
                .unwrap_or_else(|| "Unknown error".to_string());
            return Err(CaptchaError::RequestFailed(error_msg));
        }

        let score = verify_response.score.unwrap_or(0.0);

        if score < self.threshold {
            return Err(CaptchaError::LowScore(score));
        }

        Ok(score)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_captcha_service_creation() {
        let service = CaptchaService::new("test_secret".to_string(), 0.5);
        assert_eq!(service.threshold, 0.5);
        assert_eq!(service.secret_key, "test_secret");
    }

    #[test]
    fn test_captcha_error_display() {
        let error = CaptchaError::InvalidToken;
        assert_eq!(error.to_string(), "Invalid reCAPTCHA token");

        let error = CaptchaError::LowScore(0.3);
        assert!(error.to_string().contains("0.30"));

        let error = CaptchaError::RequestFailed("Network error".to_string());
        assert!(error.to_string().contains("Network error"));
    }
}
