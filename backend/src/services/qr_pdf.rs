use anyhow::{Context, Result};
use printpdf::*;
use qrcode::QrCode;
use ::image::Rgb;
use ::image::codecs::png::PngEncoder;
use ::image::ImageEncoder;
use std::io::{BufWriter, Write};

/// Avery 18660 template specifications
/// 1" x 1" square labels, 30 labels per sheet (3 columns x 10 rows)
/// Sheet size: 8.5" x 11" (US Letter)
/// Label size: 1" x 1"
/// Horizontal spacing: 0.25" between labels
/// Vertical spacing: 0.25" between labels
/// Top margin: 0.5"
/// Left margin: 0.25"
pub struct Avery18660;

impl Avery18660 {
    pub const LABEL_WIDTH_INCHES: f32 = 1.0;
    pub const LABEL_HEIGHT_INCHES: f32 = 1.0;
    pub const LABELS_PER_ROW: usize = 3;
    pub const LABELS_PER_COLUMN: usize = 10;
    pub const LABELS_PER_SHEET: usize = 30;
    pub const HORIZONTAL_SPACING_INCHES: f32 = 0.25;
    pub const VERTICAL_SPACING_INCHES: f32 = 0.25;
    pub const TOP_MARGIN_INCHES: f32 = 0.5;
    pub const LEFT_MARGIN_INCHES: f32 = 0.25;
    pub const SHEET_WIDTH_INCHES: f32 = 8.5;
    pub const SHEET_HEIGHT_INCHES: f32 = 11.0;
}

/// Generate a QR code image from data
pub fn generate_qr_code_image(data: &str, size_pixels: u32) -> Result<Vec<u8>> {
    let qr = QrCode::new(data)
        .context("Failed to generate QR code")?;
    
    let image = qr.render::<Rgb<u8>>()
        .max_dimensions(size_pixels, size_pixels)
        .build();
    
    let mut buffer = Vec::new();
    let encoder = PngEncoder::new(&mut buffer);
    encoder.write_image(
        image.as_raw(),
        image.width(),
        image.height(),
        ::image::ExtendedColorType::Rgb8,
    )
    .context("Failed to write QR code image")?;
    
    Ok(buffer)
}

/// Generate a PDF with labels for Avery 18660 template
pub fn generate_label_pdf(
    labels: &[(String, i32)], // (qr_data, number)
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
    let vertical_spacing = Avery18660::VERTICAL_SPACING_INCHES * 72.0;
    let top_margin_pt = Avery18660::TOP_MARGIN_INCHES * 72.0;
    let left_margin_pt = Avery18660::LEFT_MARGIN_INCHES * 72.0;
    let sheet_height_pt = Avery18660::SHEET_HEIGHT_INCHES * 72.0;
    
    // QR code size within label (0.75" to leave room for number)
    let qr_size_pixels = 200; // Good resolution for 0.75" at 300 DPI
    let qr_size_pt = 0.75 * 72.0;
    
    // Add Helvetica font for text
    let font = doc.add_builtin_font(BuiltinFont::HelveticaBold)
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
            let x = left_margin_pt + (col as f32) * (label_width_pt + horizontal_spacing);
            let y = sheet_height_pt - top_margin_pt - ((row as f32) * (label_height_pt + vertical_spacing)) - label_height_pt;
            
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
            
            // Position and scale the image (convert points to mm for ImageTransform)
            let qr_x = x + (label_width_pt - qr_size_pt) / 2.0;
            let qr_y = y + label_height_pt - qr_size_pt - 10.0; // 10pt margin from top
            
            // Create ImageTransform for positioning and scaling (uses Mm, not Pt)
            let transform = ImageTransform {
                translate_x: Some(Mm(qr_x / 72.0 * 25.4)), // Convert points to mm
                translate_y: Some(Mm(qr_y / 72.0 * 25.4)), // Convert points to mm
                rotate: None,
                scale_x: Some(qr_size_pt / rgb_img.width() as f32),
                scale_y: Some(qr_size_pt / rgb_img.height() as f32),
                dpi: Some(300.0),
            };
            
            // Add image to layer
            image.add_to_layer(layer.clone(), transform);
            
            // Add label number text below QR code
            let number_text = format!("#{}", number);
            let font_size = 12.0;
            let text_x = x + label_width_pt / 2.0;
            let text_y = y + 5.0; // 5pt from bottom
            
            // Center the text (approximate)
            let text_width = number_text.len() as f32 * font_size * 0.6;
            let centered_x = text_x - text_width / 2.0;
            
            layer.use_text(number_text, font_size, Mm(centered_x / 25.4), Mm(text_y / 25.4), &font);
        }
    }
    
    // Write PDF to bytes
    let mut buffer = Vec::new();
    {
        let mut writer = BufWriter::new(&mut buffer);
        doc.save(&mut writer)
            .context("Failed to save PDF")?;
        writer.flush().context("Failed to flush PDF buffer")?;
    }
    
    Ok(buffer)
}
