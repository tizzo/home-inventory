use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

use crate::models::{
    FloorPlanRoom, ItemImportDraftItem, LocationUpdateProposal, PlacementSuggestion,
};

/// Model used for all vision requests.
const VISION_MODEL: &str = "claude-sonnet-5-5";

/// Output cap for a vision request. Thinking tokens count toward this, so it
/// leaves room for reasoning plus the JSON answer.
const VISION_MAX_TOKENS: u32 = 16000;

pub struct VisionService {
    client: Client,
    api_key: String,
}

pub enum LocationType {
    Container,
    Shelf,
    Room,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    output_config: OutputConfig,
    messages: Vec<Message>,
}

#[derive(Debug, Serialize)]
struct OutputConfig {
    effort: String,
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
    #[serde(default)]
    stop_reason: Option<String>,
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

        let text = self.request_text(content_blocks, "low").await?;

        parse_items_from_response(&text)
    }
}

/// Pull the answer text out of a response, turning refusals and truncated
/// output into errors instead of trying to parse them.
fn response_text(response: AnthropicResponse) -> anyhow::Result<String> {
    match response.stop_reason.as_deref() {
        Some("refusal") => {
            return Err(anyhow::anyhow!(
                "The AI service declined to analyze this image."
            ));
        }
        Some("max_tokens") => {
            return Err(anyhow::anyhow!(
                "The AI response was cut off before it finished. Please try again."
            ));
        }
        _ => {}
    }

    response
        .content
        .into_iter()
        .find_map(|c| c.text)
        .ok_or_else(|| anyhow::anyhow!("No text response from Anthropic"))
}

impl VisionService {
    /// Suggest where unplaced shelving units belong on a floor plan image.
    ///
    /// Only units without a position are considered. Suggestions for unknown
    /// units are dropped and coordinates are clamped to the image.
    pub async fn suggest_floor_plan_placements(
        &self,
        image_data: &[u8],
        media_type: &str,
        rooms: &[FloorPlanRoom],
    ) -> anyhow::Result<Vec<PlacementSuggestion>> {
        let content = vec![
            Content::Image {
                source: ImageSource {
                    source_type: "base64".to_string(),
                    media_type: media_type.to_string(),
                    data: base64_encode(image_data),
                },
            },
            Content::Text {
                text: build_floor_plan_prompt(rooms),
            },
        ];

        // Locating rooms on a drawing takes more reasoning than listing items
        let text = self.request_text(content, "medium").await?;

        parse_floor_plan_response(&text, rooms)
    }

    /// Send one user message to the Anthropic API and return the answer text.
    async fn request_text(&self, content: Vec<Content>, effort: &str) -> anyhow::Result<String> {
        let request = AnthropicRequest {
            model: VISION_MODEL.to_string(),
            max_tokens: VISION_MAX_TOKENS,
            output_config: OutputConfig {
                effort: effort.to_string(),
            },
            messages: vec![Message {
                role: "user".to_string(),
                content,
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
        response_text(anthropic_response)
    }
}

/// Strip a Markdown code fence from around a JSON answer, if there is one.
fn strip_code_fence(text: &str) -> &str {
    let text = text.trim();
    if text.starts_with("```json") {
        text.trim_start_matches("```json")
            .trim_end_matches("```")
            .trim()
    } else if text.starts_with("```") {
        text.trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        text
    }
}

fn build_floor_plan_prompt(rooms: &[FloorPlanRoom]) -> String {
    let mut units_list = String::new();
    for room in rooms {
        let unplaced: Vec<_> = room.units.iter().filter(|u| u.position.is_none()).collect();
        if unplaced.is_empty() {
            continue;
        }
        units_list.push_str(&format!("\nRoom: {}\n", room.name));
        for unit in unplaced {
            let description = unit
                .description
                .as_deref()
                .filter(|d| !d.trim().is_empty())
                .map(|d| format!(" - {}", d))
                .unwrap_or_default();
            units_list.push_str(&format!(
                "  - {} (id: {}){}\n",
                unit.name, unit.id, description
            ));
        }
    }

    format!(
        r#"This image is a floor plan of a home. Suggest where each of the shelving units below is most likely located on it.

Shelving units to place, grouped by the room they are in:
{units_list}
For each unit:
1. Find its room on the floor plan, using the room labels drawn on the plan.
2. Pick a plausible spot inside that room. Shelving usually stands against a wall, in a corner, or in a closet or storage area. Use the unit's name and description as hints.
3. Give units in the same room different spots so their markers do not overlap.

Return a JSON object with this exact structure:
{{
  "suggestions": [
    {{
      "shelving_unit_id": "the id given above",
      "x_percent": 25.5,
      "y_percent": 42.3,
      "confidence": "high",
      "reasoning": "One short sentence on why this spot"
    }}
  ]
}}

Coordinates are percentages of the image size: x_percent runs from 0 at the left edge to 100 at the right edge, and y_percent from 0 at the top edge to 100 at the bottom edge.

Use "high" confidence when the room is clearly labelled, "medium" when you inferred the room, and "low" when you could not find the room and are guessing. Include every unit listed. Return only the JSON object."#,
        units_list = units_list
    )
}

fn parse_floor_plan_response(
    text: &str,
    rooms: &[FloorPlanRoom],
) -> anyhow::Result<Vec<PlacementSuggestion>> {
    #[derive(Deserialize)]
    struct ParsedSuggestions {
        suggestions: Vec<ParsedSuggestion>,
    }

    #[derive(Deserialize)]
    struct ParsedSuggestion {
        shelving_unit_id: String,
        x_percent: f64,
        y_percent: f64,
        #[serde(default)]
        confidence: Option<String>,
        #[serde(default)]
        reasoning: Option<String>,
    }

    let parsed: ParsedSuggestions = serde_json::from_str(strip_code_fence(text)).map_err(|e| {
        tracing::error!("Failed to parse floor plan AI response: {}", e);
        tracing::error!("Raw response: {}", text);
        anyhow::anyhow!("Failed to parse AI response: {}", e)
    })?;

    // Only accept suggestions for units we asked about, once each
    let mut unplaced: std::collections::HashSet<uuid::Uuid> = rooms
        .iter()
        .flat_map(|r| r.units.iter())
        .filter(|u| u.position.is_none())
        .map(|u| u.id)
        .collect();

    let suggestions = parsed
        .suggestions
        .into_iter()
        .filter_map(|s| {
            let id = uuid::Uuid::parse_str(s.shelving_unit_id.trim()).ok()?;
            if !s.x_percent.is_finite() || !s.y_percent.is_finite() || !unplaced.remove(&id) {
                return None;
            }
            let confidence = match s.confidence.as_deref() {
                Some("high") => "high",
                Some("medium") => "medium",
                _ => "low",
            };
            Some(PlacementSuggestion {
                shelving_unit_id: id,
                x_percent: s.x_percent.clamp(0.0, 100.0),
                y_percent: s.y_percent.clamp(0.0, 100.0),
                confidence: confidence.to_string(),
                reasoning: s.reasoning.unwrap_or_default(),
            })
        })
        .collect();

    Ok(suggestions)
}

fn build_prompt(hint: Option<&str>, location_type: LocationType) -> String {
    let location_name = match location_type {
        LocationType::Container => "container",
        LocationType::Shelf => "shelf",
        LocationType::Room => "room",
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
        preposition = match location_type {
            LocationType::Shelf => "on ",
            _ => "in ",
        },
        location = location_name,
        hint = hint_text
    )
}

fn parse_items_from_response(
    text: &str,
) -> anyhow::Result<(Vec<ItemImportDraftItem>, Option<LocationUpdateProposal>)> {
    let json_str = strip_code_fence(text);

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

    fn floor_plan_rooms() -> (Vec<FloorPlanRoom>, uuid::Uuid, uuid::Uuid) {
        use crate::models::{FloorPlanUnit, UnitPosition};
        let unplaced = uuid::Uuid::new_v4();
        let placed = uuid::Uuid::new_v4();
        let rooms = vec![FloorPlanRoom {
            id: uuid::Uuid::new_v4(),
            name: "Garage".to_string(),
            units: vec![
                FloorPlanUnit {
                    id: unplaced,
                    name: "Metal rack".to_string(),
                    description: Some("By the door".to_string()),
                    position: None,
                },
                FloorPlanUnit {
                    id: placed,
                    name: "Workbench shelves".to_string(),
                    description: None,
                    position: Some(UnitPosition {
                        x_percent: 10.0,
                        y_percent: 20.0,
                    }),
                },
            ],
        }];
        (rooms, unplaced, placed)
    }

    #[test]
    fn test_floor_plan_prompt_lists_only_unplaced_units() {
        let (rooms, unplaced, placed) = floor_plan_rooms();
        let prompt = build_floor_plan_prompt(&rooms);
        assert!(prompt.contains("Room: Garage"));
        assert!(prompt.contains(&format!("Metal rack (id: {}) - By the door", unplaced)));
        assert!(!prompt.contains(&placed.to_string()));
    }

    #[test]
    fn test_parse_floor_plan_response_basic() {
        let (rooms, unplaced, _) = floor_plan_rooms();
        let json = format!(
            r#"```json
{{"suggestions":[{{"shelving_unit_id":"{}","x_percent":25.5,"y_percent":42.0,"confidence":"high","reasoning":"Along the north wall"}}]}}
```"#,
            unplaced
        );
        let suggestions = parse_floor_plan_response(&json, &rooms).unwrap();
        assert_eq!(
            suggestions,
            vec![PlacementSuggestion {
                shelving_unit_id: unplaced,
                x_percent: 25.5,
                y_percent: 42.0,
                confidence: "high".to_string(),
                reasoning: "Along the north wall".to_string(),
            }]
        );
    }

    #[test]
    fn test_parse_floor_plan_response_drops_unknown_placed_and_duplicate_units() {
        let (rooms, unplaced, placed) = floor_plan_rooms();
        let json = format!(
            r#"{{"suggestions":[
                {{"shelving_unit_id":"{unplaced}","x_percent":10,"y_percent":10}},
                {{"shelving_unit_id":"{unplaced}","x_percent":90,"y_percent":90}},
                {{"shelving_unit_id":"{placed}","x_percent":50,"y_percent":50}},
                {{"shelving_unit_id":"{other}","x_percent":50,"y_percent":50}},
                {{"shelving_unit_id":"not-a-uuid","x_percent":50,"y_percent":50}}
            ]}}"#,
            unplaced = unplaced,
            placed = placed,
            other = uuid::Uuid::new_v4()
        );
        let suggestions = parse_floor_plan_response(&json, &rooms).unwrap();
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].shelving_unit_id, unplaced);
        assert_eq!(suggestions[0].x_percent, 10.0);
        // Missing confidence falls back to the most cautious value
        assert_eq!(suggestions[0].confidence, "low");
        assert_eq!(suggestions[0].reasoning, "");
    }

    #[test]
    fn test_parse_floor_plan_response_clamps_coordinates() {
        let (rooms, unplaced, _) = floor_plan_rooms();
        let json = format!(
            r#"{{"suggestions":[{{"shelving_unit_id":"{}","x_percent":-5,"y_percent":140,"confidence":"certain"}}]}}"#,
            unplaced
        );
        let suggestions = parse_floor_plan_response(&json, &rooms).unwrap();
        assert_eq!(suggestions[0].x_percent, 0.0);
        assert_eq!(suggestions[0].y_percent, 100.0);
        assert_eq!(suggestions[0].confidence, "low");
    }

    #[test]
    fn test_parse_floor_plan_response_invalid_json() {
        let (rooms, _, _) = floor_plan_rooms();
        assert!(parse_floor_plan_response("I could not read the plan", &rooms).is_err());
    }

    fn response(json: &str) -> AnthropicResponse {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn test_response_text_skips_thinking_blocks() {
        let r = response(
            r#"{"content":[{"type":"thinking","thinking":""},{"type":"text","text":"hello"}],"stop_reason":"end_turn"}"#,
        );
        assert_eq!(response_text(r).unwrap(), "hello");
    }

    #[test]
    fn test_response_text_rejects_refusal() {
        let r = response(r#"{"content":[],"stop_reason":"refusal"}"#);
        assert!(response_text(r).is_err());
    }

    #[test]
    fn test_response_text_rejects_truncated_output() {
        let r = response(
            r#"{"content":[{"type":"text","text":"{\"items\": ["}],"stop_reason":"max_tokens"}"#,
        );
        assert!(response_text(r).is_err());
    }

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
