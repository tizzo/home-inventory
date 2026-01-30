use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

use crate::models::{ItemImportDraftItem, LocationUpdateProposal};

pub struct VisionService {
    client: Client,
    api_key: String,
}

pub enum LocationType {
    Container,
    Shelf,
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
    #[serde(default, alias = "container_description", alias = "shelf_description")]
    location_description: Option<String>,
    #[serde(default, alias = "container_tags", alias = "shelf_tags")]
    location_tags: Option<Vec<String>>,
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
        images: Vec<(&[u8], &str)>,
        hint: Option<&str>,
        location_type: LocationType,
    ) -> anyhow::Result<(Vec<ItemImportDraftItem>, Option<LocationUpdateProposal>)> {
        if images.is_empty() {
            return Err(anyhow::anyhow!(
                "At least one image is required for analysis"
            ));
        }

        let mut content_blocks: Vec<Content> = Vec::new();

        // Add all images as content blocks
        for (image_data, media_type) in images {
            let base64_image = base64_encode(image_data);
            content_blocks.push(Content::Image {
                source: ImageSource {
                    source_type: "base64".to_string(),
                    media_type: media_type.to_string(),
                    data: base64_image,
                },
            });
        }

        // Add text prompt (with hint incorporated)
        let prompt = build_prompt(hint, location_type);
        content_blocks.push(Content::Text { text: prompt });

        let request = AnthropicRequest {
            model: "claude-sonnet-4-20250514".to_string(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content: content_blocks,
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

fn build_prompt(hint: Option<&str>, location_type: LocationType) -> String {
    let location_name = match location_type {
        LocationType::Container => "container",
        LocationType::Shelf => "shelf",
    };

    let hint_text = match hint {
        Some(h) => format!(
            "\n\nUser context: {}\n\nConsider this context when identifying items and suggesting descriptions/tags.",
            h
        ),
        None => String::new(),
    };

    format!(
        r#"Analyze these images and identify all distinct items/objects visible {preposition}the {location}. Also suggest a description for the {location} and relevant tags.{hint}

For each item, provide:
1. A clear, concise name
2. A brief description (optional, only if helpful)

For the {location}, suggest:
1. A description based on what you see
2. Relevant tags that categorize the contents

Return your response as a JSON object with this exact structure:
{{
  "items": [
    {{"name": "Item name", "description": "Brief description or null"}},
    ...
  ],
  "{location}_description": "Description of what the {location} holds",
  "{location}_tags": ["tag1", "tag2", ...]
}}

Focus on physical objects that would be stored in a home inventory system (household items, tools, electronics, supplies, etc.).

For tags, use simple, searchable terms like: "tools", "electronics", "office-supplies", "kitchen", "bathroom", "hardware", "crafts", etc.

Return ONLY the JSON object, no other text."#,
        preposition = if matches!(location_type, LocationType::Shelf) {
            "on "
        } else {
            "in "
        },
        location = location_name,
        hint = hint_text
    )
}

fn parse_items_from_response(
    text: &str,
) -> anyhow::Result<(Vec<ItemImportDraftItem>, Option<LocationUpdateProposal>)> {
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

    let location_updates = if parsed.location_description.is_some()
        || (parsed.location_tags.is_some() && !parsed.location_tags.as_ref().unwrap().is_empty())
    {
        Some(LocationUpdateProposal {
            description: parsed.location_description,
            tags: parsed.location_tags,
        })
    } else {
        None
    };

    Ok((items, location_updates))
}

fn base64_encode(bytes: &[u8]) -> String {
    STANDARD.encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_encode() {
        let data = b"hello world";
        let encoded = base64_encode(data);

        assert_eq!(encoded, "aGVsbG8gd29ybGQ=");
    }

    #[test]
    fn test_base64_encode_empty() {
        let data = b"";
        let encoded = base64_encode(data);

        assert_eq!(encoded, "");
    }

    #[test]
    fn test_base64_encode_binary() {
        let data = vec![0x00, 0x01, 0x02, 0xFF];
        let encoded = base64_encode(&data);

        // Verify it's valid base64
        assert!(!encoded.is_empty());
        // Base64 should only contain A-Z, a-z, 0-9, +, /, and = for padding
        assert!(encoded
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '='));
    }

    #[test]
    fn test_parse_items_from_response_basic() {
        let json = r#"{
            "items": [
                {"name": "Hammer", "description": "A tool"},
                {"name": "Screwdriver", "description": null}
            ],
            "container_description": "Toolbox",
            "container_tags": ["tools", "hardware"]
        }"#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (items, location_updates) = result.unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Hammer");
        assert_eq!(items[0].description, Some("A tool".to_string()));
        assert_eq!(items[1].name, "Screwdriver");
        assert_eq!(items[1].description, None);

        assert!(location_updates.is_some());
        let updates = location_updates.unwrap();
        assert_eq!(updates.description, Some("Toolbox".to_string()));
        assert_eq!(
            updates.tags,
            Some(vec!["tools".to_string(), "hardware".to_string()])
        );
    }

    #[test]
    fn test_parse_items_from_response_with_code_block() {
        let json = r#"```json
        {
            "items": [{"name": "Item 1"}],
            "container_description": "Test container"
        }
        ```"#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (items, location_updates) = result.unwrap();
        assert_eq!(items.len(), 1);
        assert!(location_updates.is_some());
    }

    #[test]
    fn test_parse_items_from_response_with_code_block_no_json() {
        let json = r#"```
        {
            "items": [{"name": "Item 1"}],
            "container_description": "Test container"
        }
        ```"#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (items, _) = result.unwrap();
        assert_eq!(items.len(), 1);
    }

    #[test]
    fn test_parse_items_from_response_empty_items() {
        let json = r#"{
            "items": [],
            "container_description": null,
            "container_tags": null
        }"#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (items, location_updates) = result.unwrap();
        assert_eq!(items.len(), 0);
        assert!(location_updates.is_none());
    }

    #[test]
    fn test_parse_items_from_response_no_location_updates() {
        let json = r#"{
            "items": [{"name": "Item 1"}],
            "container_description": null,
            "container_tags": null
        }"#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (items, location_updates) = result.unwrap();
        assert_eq!(items.len(), 1);
        assert!(location_updates.is_none());
    }

    #[test]
    fn test_parse_items_from_response_only_description() {
        let json = r#"{
            "items": [{"name": "Item 1"}],
            "container_description": "A container",
            "container_tags": null
        }"#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (_items, location_updates) = result.unwrap();
        assert!(location_updates.is_some());
        let updates = location_updates.unwrap();
        assert_eq!(updates.description, Some("A container".to_string()));
        assert_eq!(updates.tags, None);
    }

    #[test]
    fn test_parse_items_from_response_only_tags() {
        let json = r#"{
            "items": [{"name": "Item 1"}],
            "container_description": null,
            "container_tags": ["tag1", "tag2"]
        }"#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (_items, location_updates) = result.unwrap();
        assert!(location_updates.is_some());
        let updates = location_updates.unwrap();
        assert_eq!(updates.description, None);
        assert_eq!(
            updates.tags,
            Some(vec!["tag1".to_string(), "tag2".to_string()])
        );
    }

    #[test]
    fn test_parse_items_from_response_empty_tags() {
        let json = r#"{
            "items": [{"name": "Item 1"}],
            "container_description": null,
            "container_tags": []
        }"#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (_items, location_updates) = result.unwrap();
        assert!(location_updates.is_none()); // Empty tags should result in None
    }

    #[test]
    fn test_parse_items_from_response_invalid_json() {
        let json = r#"{
            "items": [
                {"name": "Item 1"
        }"#;

        let result = parse_items_from_response(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_items_from_response_missing_items() {
        let json = r#"{
            "container_description": "Test"
        }"#;

        let result = parse_items_from_response(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_items_from_response_whitespace_handling() {
        let json = r#"   {
            "items": [{"name": "Item 1"}]
        }   "#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (items, _) = result.unwrap();
        assert_eq!(items.len(), 1);
    }

    #[test]
    fn test_parse_items_from_response_multiple_items() {
        let json = r#"{
            "items": [
                {"name": "Item 1", "description": "First item"},
                {"name": "Item 2", "description": "Second item"},
                {"name": "Item 3", "description": null}
            ],
            "container_description": "Multi-item container",
            "container_tags": ["category1", "category2", "category3"]
        }"#;

        let result = parse_items_from_response(json);
        assert!(result.is_ok());

        let (items, location_updates) = result.unwrap();
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].name, "Item 1");
        assert_eq!(items[1].name, "Item 2");
        assert_eq!(items[2].name, "Item 3");

        assert!(location_updates.is_some());
        let updates = location_updates.unwrap();
        assert_eq!(updates.tags.as_ref().unwrap().len(), 3);
    }

    #[test]
    fn test_item_import_draft_item_creation() {
        let items = vec![ItemImportDraftItem {
            name: "Test Item".to_string(),
            description: Some("Description".to_string()),
            barcode: None,
            barcode_type: None,
        }];

        assert_eq!(items[0].name, "Test Item");
        assert_eq!(items[0].description, Some("Description".to_string()));
        assert_eq!(items[0].barcode, None);
        assert_eq!(items[0].barcode_type, None);
    }
}
