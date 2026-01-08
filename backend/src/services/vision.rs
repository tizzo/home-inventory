use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

use crate::models::{ContainerUpdateProposal, ItemImportDraftItem};

pub struct VisionService {
    client: Client,
    api_key: String,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

#[derive(Debug, Serialize)]
struct Message {
    role: String,
    content: Vec<Content>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum Content {
    #[serde(rename = "image")]
    Image { source: ImageSource },
    #[serde(rename = "text")]
    Text { text: String },
}

#[derive(Debug, Serialize)]
struct ImageSource {
    #[serde(rename = "type")]
    source_type: String,
    media_type: String,
    data: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<ResponseContent>,
}

#[derive(Debug, Deserialize)]
struct ResponseContent {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ParsedResponse {
    items: Vec<ParsedItem>,
    container_description: Option<String>,
    container_tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ParsedItem {
    name: String,
    description: Option<String>,
}

impl VisionService {
    pub fn new() -> anyhow::Result<Self> {
        let api_key = env::var("ANTHROPIC_API_KEY")
            .map_err(|_| anyhow::anyhow!("ANTHROPIC_API_KEY environment variable not set"))?;

        let client = Client::new();

        Ok(Self { client, api_key })
    }

    pub async fn analyze_image_for_items(
        &self,
        image_data: &[u8],
        media_type: &str,
    ) -> anyhow::Result<(Vec<ItemImportDraftItem>, Option<ContainerUpdateProposal>)> {
        let base64_image = base64_encode(image_data);

        let request = AnthropicRequest {
            model: "claude-sonnet-4-20250514".to_string(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content: vec![
                    Content::Image {
                        source: ImageSource {
                            source_type: "base64".to_string(),
                            media_type: media_type.to_string(),
                            data: base64_image,
                        },
                    },
                    Content::Text {
                        text: PROMPT.to_string(),
                    },
                ],
            }],
        };

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();

            // Parse error details for better handling
            let error_msg = if status.as_u16() == 429 {
                "Rate limit exceeded. Please wait a moment and try again."
            } else if status.as_u16() == 401 {
                "Invalid API key. Please check your ANTHROPIC_API_KEY configuration."
            } else if status.as_u16() == 400 {
                "Invalid request. The image may be too large or in an unsupported format."
            } else {
                "Failed to analyze image. Please try again later."
            };

            tracing::error!("Anthropic API error: {} - {}", status, body);
            return Err(anyhow::anyhow!("{}", error_msg));
        }

        let anthropic_response: AnthropicResponse = response.json().await?;

        let text = anthropic_response
            .content
            .into_iter()
            .find_map(|c| c.text)
            .ok_or_else(|| anyhow::anyhow!("No text response from Anthropic"))?;

        parse_items_from_response(&text)
    }
}

const PROMPT: &str = r#"Analyze this image and identify all distinct items/objects visible in the container. Also suggest a description for the container and relevant tags.

For each item, provide:
1. A clear, concise name
2. A brief description (optional, only if helpful)

For the container, suggest:
1. A description based on what you see
2. Relevant tags that categorize the contents

Return your response as a JSON object with this exact structure:
{
  "items": [
    {"name": "Item name", "description": "Brief description or null"},
    ...
  ],
  "container_description": "Description of what the container holds",
  "container_tags": ["tag1", "tag2", ...]
}

Focus on physical objects that would be stored in a home inventory system (household items, tools, electronics, supplies, etc.). 

For tags, use simple, searchable terms like: "tools", "electronics", "office-supplies", "kitchen", "bathroom", "hardware", "crafts", etc.

Return ONLY the JSON object, no other text."#;

fn parse_items_from_response(text: &str) -> anyhow::Result<(Vec<ItemImportDraftItem>, Option<ContainerUpdateProposal>)> {
    let text = text.trim();
    let json_str = if text.starts_with("```json") {
        text.trim_start_matches("```json")
            .trim_end_matches("```")
            .trim()
    } else if text.starts_with("```") {
        text.trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        text
    };

    let parsed: ParsedResponse = serde_json::from_str(json_str).map_err(|e| {
        tracing::error!("Failed to parse AI response: {}", e);
        tracing::error!("Raw response: {}", text);
        anyhow::anyhow!("Failed to parse AI response: {}", e)
    })?;

    let items = parsed
        .items
        .into_iter()
        .map(|item| ItemImportDraftItem {
            name: item.name,
            description: item.description,
            barcode: None,
            barcode_type: None,
        })
        .collect();

    let container_updates = if parsed.container_description.is_some() || (parsed.container_tags.is_some() && !parsed.container_tags.as_ref().unwrap().is_empty()) {
        Some(ContainerUpdateProposal {
            description: parsed.container_description,
            tags: parsed.container_tags,
        })
    } else {
        None
    };

    Ok((items, container_updates))
}

fn base64_encode(bytes: &[u8]) -> String {
    STANDARD.encode(bytes)
}
