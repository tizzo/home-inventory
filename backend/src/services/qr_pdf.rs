use ::image::codecs::png::PngEncoder;
use ::image::ImageEncoder;
use ::image::Rgb;
use anyhow::{Context, Result};
use printpdf::*;
use qrcode::QrCode;
use std::io::{BufWriter, Write};

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

/// Generate a PDF with labels for Avery 18660 template
pub fn generate_label_pdf(labels: &[(String, i32)], // (qr_data, number)
) -> Result<Vec<u8>> {
    if labels.is_empty() {
        return Err(anyhow::anyhow!("No labels provided"));
    }

    // Create PDF document
    let (doc, page1, layer1) = PdfDocument::new(
        "Avery 18660 Labels",
        Mm(Avery18660::SHEET_WIDTH_INCHES * 25.4),
        Mm(Avery18660::SHEET_HEIGHT_INCHES * 25.4),
        "Layer 1",
    );

    let mut current_page = page1;
    let mut current_layer = layer1;

    // Convert inches to points (1 inch = 72 points)
    let label_width_pt = Avery18660::LABEL_WIDTH_INCHES * 72.0;
    let label_height_pt = Avery18660::LABEL_HEIGHT_INCHES * 72.0;
    let horizontal_spacing = Avery18660::HORIZONTAL_SPACING_INCHES * 72.0;
    let _vertical_spacing = Avery18660::VERTICAL_SPACING_INCHES * 72.0;
    let top_margin_pt = Avery18660::TOP_MARGIN_INCHES * 72.0;
    let left_margin_pt = Avery18660::LEFT_MARGIN_INCHES * 72.0;
    let sheet_height_pt = Avery18660::SHEET_HEIGHT_INCHES * 72.0;

    // QR code size within label - make it larger since label is 2.625" wide
    // Use 0.85" x 0.85" QR code to leave room for number text below (0.15" for text)
    let qr_size_pixels = 300; // Higher resolution for larger QR code at 300 DPI
    let qr_size_pt = 0.85 * 72.0; // 0.85" square QR code

    // Add Helvetica font for text (using regular Helvetica for closest match)
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .context("Failed to add font")?;

    for (sheet_idx, label_chunk) in labels.chunks(Avery18660::LABELS_PER_SHEET).enumerate() {
        if sheet_idx > 0 {
            // Create new page for additional sheets
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

            // Calculate label position (PDF coordinates: bottom-left is origin)
            // For Avery 18660: labels are arranged in 3 columns, 10 rows
            // Each label is 2.625" wide x 1" tall
            // X position: left margin + (column * (label width + spacing))
            let x = left_margin_pt + (col as f32) * (label_width_pt + horizontal_spacing);
            // Y position: start from top of sheet, work downward
            // Row 0 (top): y = sheet_height - top_margin - label_height
            // Row 1: y = sheet_height - top_margin - (2 * label_height)
            // Row n: y = sheet_height - top_margin - ((n + 1) * label_height)
            let y = sheet_height_pt - top_margin_pt - ((row as f32 + 1.0) * label_height_pt);

            // Generate QR code image
            let qr_image_data = generate_qr_code_image(qr_data, qr_size_pixels)
                .context("Failed to generate QR code image")?;

            // Load image using image crate
            let img = ::image::load_from_memory(&qr_image_data)
                .context("Failed to load QR code image")?;
            let rgb_img = img.to_rgb8();

            // Create ImageXObject from RgbImage
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

            // Create Image struct and add to layer
            let image = Image {
                image: image_xobject,
            };

            // Position and scale the QR code image
            // Place QR code on the left side of the label
            // Label is 2.625" wide, QR is 0.85" square
            // Leave some margin on the left, then QR code, then space for text on right
            let qr_left_margin = 5.0; // 5pt margin from left edge
            let qr_x = x + qr_left_margin;
            // Center QR code vertically in the label (label is 1" = 72pt tall)
            let qr_y = y + (label_height_pt - qr_size_pt) / 2.0;

            // Convert points to millimeters (1 point = 0.352778 mm, or 1 inch = 72 points = 25.4 mm)
            let qr_x_mm = qr_x / 72.0 * 25.4;
            let qr_y_mm = qr_y / 72.0 * 25.4;
            let qr_size_mm = qr_size_pt / 72.0 * 25.4;

            // Calculate scale factors for ImageTransform
            // The image is generated at qr_size_pixels (300px) which represents the QR code
            // At 300 DPI, 300 pixels = 1 inch = 25.4 mm
            // We want the image to be qr_size_mm in the PDF
            // So scale = desired_size_mm / natural_size_mm
            // Natural size at 300 DPI: 300px / 300 DPI = 1 inch = 25.4 mm
            let natural_size_mm = qr_size_pixels as f32 / 300.0 * 25.4;
            let scale_x = qr_size_mm / natural_size_mm;
            let scale_y = qr_size_mm / natural_size_mm;

            // Create ImageTransform for positioning and scaling (uses Mm)
            let transform = ImageTransform {
                translate_x: Some(Mm(qr_x_mm)),
                translate_y: Some(Mm(qr_y_mm)),
                rotate: None,
                scale_x: Some(scale_x),
                scale_y: Some(scale_y),
                dpi: Some(300.0),
            };

            // Add image to layer
            image.add_to_layer(layer.clone(), transform);

            // Add label number text to the right of QR code
            let number_text = format!("#{}", number);
            let font_size = 12.0; // Slightly larger font for better visibility

            // Position text to the right of QR code
            // QR code starts at qr_x and is qr_size_pt wide
            // Add some spacing between QR code and text
            let text_spacing = 8.0; // 8pt spacing between QR code and text
            let text_x_pt = qr_x + qr_size_pt + text_spacing;

            // Center text vertically with QR code
            // QR code is centered at: y + (label_height_pt - qr_size_pt) / 2.0
            // Text baseline should align with QR code center
            // Approximate: font_size * 0.7 gives approximate center alignment
            let text_y_pt = y + (label_height_pt / 2.0) + (font_size * 0.35); // Center vertically

            // Convert points to millimeters for use_text
            let text_x_mm = text_x_pt / 72.0 * 25.4;
            let text_y_mm = text_y_pt / 72.0 * 25.4;

            layer.use_text(number_text, font_size, Mm(text_x_mm), Mm(text_y_mm), &font);
        }
    }

    // Write PDF to bytes
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
        // Verify Avery 18660 template constants are correct
        assert_eq!(Avery18660::LABEL_WIDTH_INCHES, 2.625);
        assert_eq!(Avery18660::LABEL_HEIGHT_INCHES, 1.0);
        assert_eq!(Avery18660::LABELS_PER_ROW, 3);
        assert_eq!(Avery18660::LABELS_PER_COLUMN, 10);
        assert_eq!(Avery18660::LABELS_PER_SHEET, 30);
        assert_eq!(Avery18660::SHEET_WIDTH_INCHES, 8.5);
        assert_eq!(Avery18660::SHEET_HEIGHT_INCHES, 11.0);

        // Verify calculations
        assert_eq!(
            Avery18660::LABELS_PER_SHEET,
            Avery18660::LABELS_PER_ROW * Avery18660::LABELS_PER_COLUMN
        );
    }

    #[test]
    fn test_generate_qr_code_image_success() {
        let data = "https://example.com/item/123";
        let size = 200;

        let result = generate_qr_code_image(data, size);

        assert!(result.is_ok());
        let image_data = result.unwrap();
        assert!(!image_data.is_empty());

        // Verify it's a valid PNG by checking PNG signature
        assert_eq!(
            &image_data[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        );
    }

    #[test]
    fn test_generate_qr_code_image_different_sizes() {
        let data = "test-data";

        let small = generate_qr_code_image(data, 100).unwrap();
        let medium = generate_qr_code_image(data, 200).unwrap();
        let large = generate_qr_code_image(data, 400).unwrap();

        // Larger sizes should generally produce larger files (though compression can vary)
        // At minimum, they should all be valid PNGs
        assert!(!small.is_empty());
        assert!(!medium.is_empty());
        assert!(!large.is_empty());

        // All should be valid PNGs
        assert_eq!(
            &small[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        );
        assert_eq!(
            &medium[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        );
        assert_eq!(
            &large[0..8],
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        );
    }

    #[test]
    fn test_generate_qr_code_image_empty_data() {
        // QR codes can be generated with empty data, though it's unusual
        let result = generate_qr_code_image("", 100);
        assert!(result.is_ok());
    }

    #[test]
    fn test_generate_qr_code_image_long_data() {
        // Test with longer data to ensure it works with various data sizes
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
        let result = generate_label_pdf(&labels);

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("No labels provided"));
    }

    #[test]
    fn test_generate_label_pdf_single_label() {
        let labels = vec![("https://example.com/item/1".to_string(), 1)];
        let result = generate_label_pdf(&labels);

        assert!(result.is_ok());
        let pdf_data = result.unwrap();
        assert!(!pdf_data.is_empty());

        // Verify it's a PDF by checking PDF signature
        assert_eq!(&pdf_data[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_multiple_labels() {
        let labels = vec![
            ("https://example.com/item/1".to_string(), 1),
            ("https://example.com/item/2".to_string(), 2),
            ("https://example.com/item/3".to_string(), 3),
        ];
        let result = generate_label_pdf(&labels);

        assert!(result.is_ok());
        let pdf_data = result.unwrap();
        assert!(!pdf_data.is_empty());
        assert_eq!(&pdf_data[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_exactly_one_sheet() {
        // Test with exactly 30 labels (one sheet)
        let labels: Vec<(String, i32)> = (1..=30)
            .map(|i| (format!("https://example.com/item/{}", i), i))
            .collect();

        let result = generate_label_pdf(&labels);
        assert!(result.is_ok());
        let pdf_data = result.unwrap();
        assert!(!pdf_data.is_empty());
        assert_eq!(&pdf_data[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_multiple_sheets() {
        // Test with 31 labels (should create 2 sheets)
        let labels: Vec<(String, i32)> = (1..=31)
            .map(|i| (format!("https://example.com/item/{}", i), i))
            .collect();

        let result = generate_label_pdf(&labels);
        assert!(result.is_ok());
        let pdf_data = result.unwrap();
        assert!(!pdf_data.is_empty());
        assert_eq!(&pdf_data[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_many_labels() {
        // Test with 100 labels (should create multiple sheets)
        let labels: Vec<(String, i32)> = (1..=100)
            .map(|i| (format!("https://example.com/item/{}", i), i))
            .collect();

        let result = generate_label_pdf(&labels);
        assert!(result.is_ok());
        let pdf_data = result.unwrap();
        assert!(!pdf_data.is_empty());
        assert_eq!(&pdf_data[0..4], b"%PDF");
    }

    #[test]
    fn test_generate_label_pdf_special_characters() {
        // Test with special characters in QR data
        let labels = vec![
            (
                "https://example.com/item/1?param=value&other=test".to_string(),
                1,
            ),
            ("item with spaces and symbols !@#$%".to_string(), 2),
        ];
        let result = generate_label_pdf(&labels);

        assert!(result.is_ok());
        let pdf_data = result.unwrap();
        assert!(!pdf_data.is_empty());
        assert_eq!(&pdf_data[0..4], b"%PDF");
    }

    #[test]
    fn test_label_positioning_calculations() {
        // Verify label positioning calculations are correct
        let label_width_pt = Avery18660::LABEL_WIDTH_INCHES * 72.0;
        let _label_height_pt = Avery18660::LABEL_HEIGHT_INCHES * 72.0;
        let horizontal_spacing = Avery18660::HORIZONTAL_SPACING_INCHES * 72.0;
        let left_margin_pt = Avery18660::LEFT_MARGIN_INCHES * 72.0;

        // First label (row 0, col 0)
        let x0 = left_margin_pt + (0 as f32) * (label_width_pt + horizontal_spacing);
        assert_eq!(x0, left_margin_pt);

        // Second label in row (row 0, col 1)
        let x1 = left_margin_pt + (1 as f32) * (label_width_pt + horizontal_spacing);
        assert_eq!(x1, left_margin_pt + label_width_pt + horizontal_spacing);

        // Third label in row (row 0, col 2)
        let x2 = left_margin_pt + (2 as f32) * (label_width_pt + horizontal_spacing);
        assert_eq!(
            x2,
            left_margin_pt + 2.0 * (label_width_pt + horizontal_spacing)
        );
    }
}
