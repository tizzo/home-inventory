use ::image::codecs::png::PngEncoder;
use ::image::ImageEncoder;
use ::image::Rgb;
use anyhow::{Context, Result};
use printpdf::*;
use qrcode::QrCode;
use std::io::{BufWriter, Write};

use super::branding;

/// Avery 18660 template specifications
/// 1" x 2-5/8" labels, 30 labels per sheet (3 columns x 10 rows)
/// Sheet size: 8.5" x 11" (US Letter)
/// Label size: 2.625" x 1" (width x height)
/// Horizontal spacing: 0.125" between columns
/// Vertical spacing: 0" between rows (labels are touching vertically)
/// Top margin: 0.5"
/// Bottom margin: 0.5"
/// Left margin: 0.19"
/// Right margin: 0.19"
pub struct Avery18660;

impl Avery18660 {
    pub const LABEL_WIDTH_INCHES: f32 = 2.625; // 2-5/8"
    pub const LABEL_HEIGHT_INCHES: f32 = 1.0;
    pub const LABELS_PER_ROW: usize = 3;
    #[allow(dead_code)]
    pub const LABELS_PER_COLUMN: usize = 10;
    pub const LABELS_PER_SHEET: usize = 30;
    pub const HORIZONTAL_SPACING_INCHES: f32 = 0.125;
    pub const VERTICAL_SPACING_INCHES: f32 = 0.0; // Labels touch vertically
    pub const TOP_MARGIN_INCHES: f32 = 0.5;
    #[allow(dead_code)]
    pub const BOTTOM_MARGIN_INCHES: f32 = 0.5;
    pub const LEFT_MARGIN_INCHES: f32 = 0.19;
    #[allow(dead_code)]
    pub const RIGHT_MARGIN_INCHES: f32 = 0.19;
    pub const SHEET_WIDTH_INCHES: f32 = 8.5;
    pub const SHEET_HEIGHT_INCHES: f32 = 11.0;
}

/// Avery Presta 94103 template specifications
/// 1" x 1" square labels, 48 labels per sheet (6 columns x 8 rows)
/// Sheet size: 8.5" x 11" (US Letter)
/// Label size: 1" x 1"
/// Horizontal spacing: 0.25" between columns
/// Vertical spacing: 0.25" between rows
/// Top margin: 0.625"
/// Bottom margin: 0.625"
/// Left margin: 0.625"
/// Right margin: 0.625"
pub struct Avery94103;

impl Avery94103 {
    pub const LABEL_WIDTH_INCHES: f32 = 1.0;
    pub const LABEL_HEIGHT_INCHES: f32 = 1.0;
    pub const LABELS_PER_ROW: usize = 6;
    #[allow(dead_code)]
    pub const LABELS_PER_COLUMN: usize = 8;
    pub const LABELS_PER_SHEET: usize = 48;
    pub const HORIZONTAL_SPACING_INCHES: f32 = 0.25;
    pub const VERTICAL_SPACING_INCHES: f32 = 0.25;
    pub const TOP_MARGIN_INCHES: f32 = 0.625;
    #[allow(dead_code)]
    pub const BOTTOM_MARGIN_INCHES: f32 = 0.625;
    pub const LEFT_MARGIN_INCHES: f32 = 0.625;
    #[allow(dead_code)]
    pub const RIGHT_MARGIN_INCHES: f32 = 0.625;
    pub const SHEET_WIDTH_INCHES: f32 = 8.5;
    pub const SHEET_HEIGHT_INCHES: f32 = 11.0;
}

/// Generate a QR code image from data
pub fn generate_qr_code_image(data: &str, size_pixels: u32) -> Result<Vec<u8>> {
    let qr = QrCode::new(data).context("Failed to generate QR code")?;

    let image = qr
        .render::<Rgb<u8>>()
        .max_dimensions(size_pixels, size_pixels)
        .build();

    let mut buffer = Vec::new();
    let encoder = PngEncoder::new(&mut buffer);
    encoder
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ::image::ExtendedColorType::Rgb8,
        )
        .context("Failed to write QR code image")?;

    Ok(buffer)
}

/// Helper: add an RGB image to a PDF layer at the given position/size (all in points)
fn add_image_to_layer(
    layer: &PdfLayerReference,
    rgb_img: &::image::RgbImage,
    x_pt: f32,
    y_pt: f32,
    size_pt: f32,
    dpi: f32,
) {
    let image_xobject = ImageXObject {
        width: Px(rgb_img.width() as usize),
        height: Px(rgb_img.height() as usize),
        color_space: ColorSpace::Rgb,
        bits_per_component: ColorBits::Bit8,
        interpolate: true,
        image_data: rgb_img.as_raw().to_vec(),
        image_filter: None,
        clipping_bbox: None,
        smask: None,
    };

    let image = Image {
        image: image_xobject,
    };

    let size_mm = size_pt / 72.0 * 25.4;
    let natural_size_mm = rgb_img.width() as f32 / dpi * 25.4;
    let scale = size_mm / natural_size_mm;

    let transform = ImageTransform {
        translate_x: Some(Mm(x_pt / 72.0 * 25.4)),
        translate_y: Some(Mm(y_pt / 72.0 * 25.4)),
        rotate: None,
        scale_x: Some(scale),
        scale_y: Some(scale),
        dpi: Some(dpi),
    };

    image.add_to_layer(layer.clone(), transform);
}

/// Helper: convert points to Mm for use_text
fn pt_to_mm(pt: f32) -> Mm {
    Mm(pt / 72.0 * 25.4)
}

/// Generate a PDF with labels for Avery 18660 template (2.625" x 1" rectangular)
///
/// Layout per label:
/// ```text
/// ┌──────────────────────────────────────────┐
/// │ ┌──────┐  ┌────┐  HOME INVENTORY  #123  │
/// │ │  QR  │  │ 🏠 │  SCAN IF FOUND         │
/// │ │ CODE │  │ H  │  REWARD                │
/// │ └──────┘  └────┘                         │
/// └──────────────────────────────────────────┘
/// ```
pub fn generate_label_pdf(labels: &[(String, i32)], family_initial: &str) -> Result<Vec<u8>> {
    if labels.is_empty() {
        return Err(anyhow::anyhow!("No labels provided"));
    }

    let (doc, page1, layer1) = PdfDocument::new(
        "Avery 18660 Labels",
        Mm(Avery18660::SHEET_WIDTH_INCHES * 25.4),
        Mm(Avery18660::SHEET_HEIGHT_INCHES * 25.4),
        "Layer 1",
    );

    let mut current_page = page1;
    let mut current_layer = layer1;

    let label_width_pt = Avery18660::LABEL_WIDTH_INCHES * 72.0;
    let label_height_pt = Avery18660::LABEL_HEIGHT_INCHES * 72.0;
    let horizontal_spacing = Avery18660::HORIZONTAL_SPACING_INCHES * 72.0;
    let _vertical_spacing = Avery18660::VERTICAL_SPACING_INCHES * 72.0;
    let top_margin_pt = Avery18660::TOP_MARGIN_INCHES * 72.0;
    let left_margin_pt = Avery18660::LEFT_MARGIN_INCHES * 72.0;
    let sheet_height_pt = Avery18660::SHEET_HEIGHT_INCHES * 72.0;

    let qr_size_pixels: u32 = 300;
    let qr_size_pt = 0.85 * 72.0;
    let logo_size_pt = 0.35 * 72.0; // House logo size
    let logo_pixels: u32 = 128;

    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .context("Failed to add font")?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .context("Failed to add bold font")?;

    // Pre-render house logo
    let logo_img = branding::render_house_logo(family_initial, logo_pixels);

    for (sheet_idx, label_chunk) in labels.chunks(Avery18660::LABELS_PER_SHEET).enumerate() {
        if sheet_idx > 0 {
            let (page, layer) = doc.add_page(
                Mm(Avery18660::SHEET_WIDTH_INCHES * 25.4),
                Mm(Avery18660::SHEET_HEIGHT_INCHES * 25.4),
                "Layer 1",
            );
            current_page = page;
            current_layer = layer;
        }

        let layer = doc.get_page(current_page).get_layer(current_layer);

        for (label_idx, (qr_data, number)) in label_chunk.iter().enumerate() {
            let row = label_idx / Avery18660::LABELS_PER_ROW;
            let col = label_idx % Avery18660::LABELS_PER_ROW;

            let x = left_margin_pt + (col as f32) * (label_width_pt + horizontal_spacing);
            let y = sheet_height_pt - top_margin_pt - ((row as f32 + 1.0) * label_height_pt);

            // Generate and place QR code on left
            let qr_image_data = generate_qr_code_image(qr_data, qr_size_pixels)
                .context("Failed to generate QR code image")?;
            let img = ::image::load_from_memory(&qr_image_data)
                .context("Failed to load QR code image")?;
            let rgb_img = img.to_rgb8();

            let qr_left_margin = 3.0;
            let qr_x = x + qr_left_margin;
            let qr_y = y + (label_height_pt - qr_size_pt) / 2.0;
            add_image_to_layer(&layer, &rgb_img, qr_x, qr_y, qr_size_pt, 300.0);

            // Place house logo next to QR code
            let logo_x = qr_x + qr_size_pt + 4.0;
            let logo_y = y + (label_height_pt - logo_size_pt) / 2.0;
            add_image_to_layer(&layer, &logo_img, logo_x, logo_y, logo_size_pt, 300.0);

            // Branding text to the right of logo
            let text_x = logo_x + logo_size_pt + 4.0;

            // Line 1: "HOME INVENTORY  #123"
            let line1 = format!("HOME INVENTORY  #{}", number);
            let line1_y = y + label_height_pt - 20.0;
            layer.use_text(line1, 8.0, pt_to_mm(text_x), pt_to_mm(line1_y), &font_bold);

            // Line 2: "SCAN IF FOUND"
            let line2_y = line1_y - 14.0;
            layer.use_text(
                "SCAN IF FOUND",
                7.0,
                pt_to_mm(text_x),
                pt_to_mm(line2_y),
                &font,
            );

            // Line 3: "REWARD"
            let line3_y = line2_y - 12.0;
            layer.use_text("REWARD", 7.0, pt_to_mm(text_x), pt_to_mm(line3_y), &font);
        }
    }

    let mut buffer = Vec::new();
    {
        let mut writer = BufWriter::new(&mut buffer);
        doc.save(&mut writer).context("Failed to save PDF")?;
        writer.flush().context("Failed to flush PDF buffer")?;
    }

    Ok(buffer)
}

/// Generate a PDF with labels for Avery Presta 94103 template (1" x 1" square)
///
/// Layout per label:
/// ```text
/// ┌───────────────────────┐
/// │   HOME  INVENTORY     │  ← top edge text
/// │ R                   S │
/// │ E    ┌─────────┐    C │  ← left: "REWARD" rotated 90° CCW
/// │ W    │   QR    │    A │  ← right: "SCAN IF FOUND" rotated 90° CW
/// │ A    │  CODE   │    N │
/// │ R    │         │      │
/// │ D    └─────────┘    I │
/// │        #123         F │
/// │                       │
/// └───────────────────────┘
/// ```
pub fn generate_label_pdf_94103(labels: &[(String, i32)], family_initial: &str) -> Result<Vec<u8>> {
    if labels.is_empty() {
        return Err(anyhow::anyhow!("No labels provided"));
    }

    // Suppress unused variable warning - initial is used for rectangular template only
    let _ = family_initial;

    let (doc, page1, layer1) = PdfDocument::new(
        "Avery 94103 Labels",
        Mm(Avery94103::SHEET_WIDTH_INCHES * 25.4),
        Mm(Avery94103::SHEET_HEIGHT_INCHES * 25.4),
        "Layer 1",
    );

    let mut current_page = page1;
    let mut current_layer = layer1;

    let label_width_pt = Avery94103::LABEL_WIDTH_INCHES * 72.0;
    let label_height_pt = Avery94103::LABEL_HEIGHT_INCHES * 72.0;
    let horizontal_spacing = Avery94103::HORIZONTAL_SPACING_INCHES * 72.0;
    let vertical_spacing = Avery94103::VERTICAL_SPACING_INCHES * 72.0;
    let top_margin_pt = Avery94103::TOP_MARGIN_INCHES * 72.0;
    let left_margin_pt = Avery94103::LEFT_MARGIN_INCHES * 72.0;
    let sheet_height_pt = Avery94103::SHEET_HEIGHT_INCHES * 72.0;

    // Edge text margins eat into space; QR code fills the remaining center
    let edge_margin = 8.0; // pts reserved for edge text on each side
    let top_text_margin = 8.0; // pts for "HOME INVENTORY" at top
    let bottom_text_margin = 10.0; // pts for label number at bottom

    // QR fills the square minus edge text areas
    let qr_size_pt = label_width_pt - 2.0 * edge_margin - 2.0; // ~0.78" minus a little padding
    let qr_size_pt = qr_size_pt.min(label_height_pt - top_text_margin - bottom_text_margin - 2.0);
    let qr_size_pixels: u32 = 300;

    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .context("Failed to add font")?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .context("Failed to add bold font")?;

    for (sheet_idx, label_chunk) in labels.chunks(Avery94103::LABELS_PER_SHEET).enumerate() {
        if sheet_idx > 0 {
            let (page, layer) = doc.add_page(
                Mm(Avery94103::SHEET_WIDTH_INCHES * 25.4),
                Mm(Avery94103::SHEET_HEIGHT_INCHES * 25.4),
                "Layer 1",
            );
            current_page = page;
            current_layer = layer;
        }

        let layer = doc.get_page(current_page).get_layer(current_layer);

        for (label_idx, (qr_data, number)) in label_chunk.iter().enumerate() {
            let row = label_idx / Avery94103::LABELS_PER_ROW;
            let col = label_idx % Avery94103::LABELS_PER_ROW;

            let x = left_margin_pt + (col as f32) * (label_width_pt + horizontal_spacing);
            let y = sheet_height_pt
                - top_margin_pt
                - ((row as f32 + 1.0) * label_height_pt)
                - (row as f32 * vertical_spacing);

            // --- QR code centered in available area ---
            let qr_image_data = generate_qr_code_image(qr_data, qr_size_pixels)
                .context("Failed to generate QR code image")?;
            let img = ::image::load_from_memory(&qr_image_data)
                .context("Failed to load QR code image")?;
            let rgb_img = img.to_rgb8();

            let qr_x = x + (label_width_pt - qr_size_pt) / 2.0;
            let qr_y = y
                + bottom_text_margin
                + (label_height_pt - top_text_margin - bottom_text_margin - qr_size_pt) / 2.0;
            add_image_to_layer(&layer, &rgb_img, qr_x, qr_y, qr_size_pt, 300.0);

            // --- "HOME INVENTORY" across top ---
            let top_text = "HOME INVENTORY";
            let top_font_size = 5.0;
            let approx_top_width = top_text.len() as f32 * top_font_size * 0.52;
            let top_text_x = x + (label_width_pt - approx_top_width) / 2.0;
            let top_text_y = y + label_height_pt - top_text_margin + 1.0;
            layer.use_text(
                top_text,
                top_font_size,
                pt_to_mm(top_text_x),
                pt_to_mm(top_text_y),
                &font_bold,
            );

            // --- Label number centered below QR ---
            let number_text = format!("#{}", number);
            let num_font_size = 5.0;
            let approx_num_width = number_text.len() as f32 * num_font_size * 0.52;
            let num_x = x + (label_width_pt - approx_num_width) / 2.0;
            let num_y = y + 2.0;
            layer.use_text(
                number_text,
                num_font_size,
                pt_to_mm(num_x),
                pt_to_mm(num_y),
                &font,
            );

            // --- "REWARD" rotated 90° CCW on left edge ---
            // Rotation: text reads bottom-to-top
            let left_text = "REWARD";
            let side_font_size = 4.5;
            // Position: left edge of label, vertically centered
            let left_text_x_pt = x + 5.0;
            let left_text_y_pt = y + label_height_pt / 2.0 - 8.0;

            layer.save_graphics_state();
            layer.set_ctm(CurTransMat::TranslateRotate(
                Pt(left_text_x_pt),
                Pt(left_text_y_pt),
                90.0, // CCW rotation
            ));
            layer.use_text(left_text, side_font_size, Mm(0.0), Mm(0.0), &font);
            layer.restore_graphics_state();

            // --- "SCAN IF FOUND" rotated 90° CW on right edge ---
            // Rotation: text reads top-to-bottom
            let right_text = "SCAN IF FOUND";
            let right_text_x_pt = x + label_width_pt - 2.0;
            let right_text_y_pt = y + label_height_pt / 2.0 + 14.0;

            layer.save_graphics_state();
            layer.set_ctm(CurTransMat::TranslateRotate(
                Pt(right_text_x_pt),
                Pt(right_text_y_pt),
                -90.0, // CW rotation (negative = clockwise)
            ));
            layer.use_text(right_text, side_font_size, Mm(0.0), Mm(0.0), &font);
            layer.restore_graphics_state();
        }
    }

    let mut buffer = Vec::new();
    {
        let mut writer = BufWriter::new(&mut buffer);
        doc.save(&mut writer).context("Failed to save PDF")?;
        writer.flush().context("Failed to flush PDF buffer")?;
    }

    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_avery18660_constants() {
        assert_eq!(Avery18660::LABEL_WIDTH_INCHES, 2.625);
        assert_eq!(Avery18660::LABEL_HEIGHT_INCHES, 1.0);
        assert_eq!(Avery18660::LABELS_PER_ROW, 3);
        assert_eq!(Avery18660::LABELS_PER_COLUMN, 10);
        assert_eq!(Avery18660::LABELS_PER_SHEET, 30);
        assert_eq!(Avery18660::SHEET_WIDTH_INCHES, 8.5);
        assert_eq!(Avery18660::SHEET_HEIGHT_INCHES, 11.0);
        assert_eq!(
            Avery18660::LABELS_PER_SHEET,
            Avery18660::LABELS_PER_ROW * Avery18660::LABELS_PER_COLUMN
        );
    }

    #[test]
    fn test_generate_qr_code_image_success() {
        let data = "https://example.com/item/123";
        let result = generate_qr_code_image(data, 200);
        assert!(result.is_ok());
        let image_data = result.unwrap();
        assert!(!image_data.is_empty());
        assert_eq!(
            &image_data[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        );
    }

    #[test]
    fn test_generate_qr_code_image_different_sizes() {
        let data = "test-data";
        for size in [100, 200, 400] {
            let result = generate_qr_code_image(data, size).unwrap();
            assert!(!result.is_empty());
            assert_eq!(
                &result[0..8],
                &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
            );
        }
    }

    #[test]
    fn test_generate_qr_code_image_empty_data() {
        let result = generate_qr_code_image("", 100);
        assert!(result.is_ok());
    }

    #[test]
    fn test_generate_qr_code_image_long_data() {
        let long_data = "a".repeat(1000);
        let result = generate_qr_code_image(&long_data, 200);
        assert!(result.is_ok());
        let image_data = result.unwrap();
        assert!(!image_data.is_empty());
        assert_eq!(
            &image_data[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        );
    }

    #[test]
    fn test_generate_label_pdf_empty_labels() {
        let labels: Vec<(String, i32)> = vec![];
        let result = generate_label_pdf(&labels, "H");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("No labels provided"));
    }

    #[test]
    fn test_generate_label_pdf_single_label() {
        let labels = vec![("https://example.com/item/1".to_string(), 1)];
        let result = generate_label_pdf(&labels, "H");
        assert!(result.is_ok());
        let pdf_data = result.unwrap();
        assert!(!pdf_data.is_empty());
        assert_eq!(&pdf_data[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_multiple_labels() {
        let labels = vec![
            ("https://example.com/item/1".to_string(), 1),
            ("https://example.com/item/2".to_string(), 2),
            ("https://example.com/item/3".to_string(), 3),
        ];
        let result = generate_label_pdf(&labels, "T");
        assert!(result.is_ok());
        let pdf_data = result.unwrap();
        assert!(!pdf_data.is_empty());
        assert_eq!(&pdf_data[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_exactly_one_sheet() {
        let labels: Vec<(String, i32)> = (1..=30)
            .map(|i| (format!("https://example.com/item/{}", i), i))
            .collect();
        let result = generate_label_pdf(&labels, "H");
        assert!(result.is_ok());
        assert_eq!(&result.unwrap()[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_multiple_sheets() {
        let labels: Vec<(String, i32)> = (1..=31)
            .map(|i| (format!("https://example.com/item/{}", i), i))
            .collect();
        let result = generate_label_pdf(&labels, "H");
        assert!(result.is_ok());
        assert_eq!(&result.unwrap()[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_many_labels() {
        let labels: Vec<(String, i32)> = (1..=100)
            .map(|i| (format!("https://example.com/item/{}", i), i))
            .collect();
        let result = generate_label_pdf(&labels, "H");
        assert!(result.is_ok());
        assert_eq!(&result.unwrap()[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_special_characters() {
        let labels = vec![
            (
                "https://example.com/item/1?param=value&other=test".to_string(),
                1,
            ),
            ("item with spaces and symbols !@#$%".to_string(), 2),
        ];
        let result = generate_label_pdf(&labels, "H");
        assert!(result.is_ok());
        assert_eq!(&result.unwrap()[0..4], b"%PDF");
    }

    #[test]
    fn test_label_positioning_calculations() {
        let label_width_pt = Avery18660::LABEL_WIDTH_INCHES * 72.0;
        let _label_height_pt = Avery18660::LABEL_HEIGHT_INCHES * 72.0;
        let horizontal_spacing = Avery18660::HORIZONTAL_SPACING_INCHES * 72.0;
        let left_margin_pt = Avery18660::LEFT_MARGIN_INCHES * 72.0;

        let x0 = left_margin_pt + (0 as f32) * (label_width_pt + horizontal_spacing);
        assert_eq!(x0, left_margin_pt);

        let x1 = left_margin_pt + (1 as f32) * (label_width_pt + horizontal_spacing);
        assert_eq!(x1, left_margin_pt + label_width_pt + horizontal_spacing);

        let x2 = left_margin_pt + (2 as f32) * (label_width_pt + horizontal_spacing);
        assert_eq!(
            x2,
            left_margin_pt + 2.0 * (label_width_pt + horizontal_spacing)
        );
    }

    #[test]
    fn test_generate_label_pdf_94103_single() {
        let labels = vec![("https://example.com/item/1".to_string(), 1)];
        let result = generate_label_pdf_94103(&labels, "H");
        assert!(result.is_ok());
        assert_eq!(&result.unwrap()[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_94103_full_sheet() {
        let labels: Vec<(String, i32)> = (1..=48)
            .map(|i| (format!("https://example.com/item/{}", i), i))
            .collect();
        let result = generate_label_pdf_94103(&labels, "H");
        assert!(result.is_ok());
        assert_eq!(&result.unwrap()[0..4], b"%PDF");
    }
}
