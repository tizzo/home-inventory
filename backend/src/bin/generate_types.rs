use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
};

use typeshare_core::{
    context::{ParseContext, ParseFileContext},
    language::{CrateTypes, Language, TypeScript},
    parser::{self, ParsedData},
};

fn main() -> anyhow::Result<()> {
    let output_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "../frontend/src/types/generated.ts".to_string());
    let output_path = PathBuf::from(output_path);

    let models_dir = PathBuf::from("src/models");

    let mut ts = TypeScript::default();
    ts.type_mappings
        .insert("Uuid".to_string(), "string".to_string());
    ts.type_mappings
        .insert("DateTime".to_string(), "Date".to_string());
    ts.type_mappings
        .insert("Utc".to_string(), "Date".to_string());
    ts.type_mappings
        .insert("Value".to_string(), "unknown".to_string());
    ts.type_mappings
        .insert("serde_json::Value".to_string(), "unknown".to_string());
    let mut combined = ParsedData::new("home_inventory_backend".into(), "generated".into(), false);

    let parse_context = ParseContext::default();

    for entry in fs::read_dir(&models_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("rs") {
            continue;
        }

        let source_code = fs::read_to_string(&path)?;

        let file_name = path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("models.rs")
            .to_string();

        let parsed = parser::parse(
            &parse_context,
            ParseFileContext {
                source_code,
                crate_name: "home_inventory_backend".into(),
                file_name,
                file_path: path.clone(),
            },
        )
        .map_err(|e| anyhow::anyhow!("Failed to parse {:?}: {}", path, e))?;

        let Some(parsed) = parsed else {
            continue;
        };

        if !parsed.errors.is_empty() {
            return Err(anyhow::anyhow!("{}", parsed.errors[0].error));
        }

        combined += parsed;
    }

    let all_types: CrateTypes = HashMap::new();

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut buf: Vec<u8> = Vec::new();
    ts.generate_types(&mut buf, &all_types, combined)?;

    let mut generated = String::from_utf8(buf)
        .map_err(|e| anyhow::anyhow!("Generated output was not valid UTF-8: {e}"))?;
    generated = generated.replace(
        "export const ReplacerFunc = (key: string, value: unknown): unknown =>",
        "export const ReplacerFunc = (_key: string, value: unknown): unknown =>",
    );
    generated = generated.replace(
        "export const ReplacerFunc = (_key: string, value: unknown): unknown => {\n",
        "export const ReplacerFunc = (_key: string, value: unknown): unknown => {\n    void _key;\n",
    );

    write_atomic(&output_path, generated.as_bytes())?;

    Ok(())
}

fn write_atomic(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");

    {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(contents)?;
        file.sync_all()?;
    }

    fs::rename(tmp, path)?;
    Ok(())
}
