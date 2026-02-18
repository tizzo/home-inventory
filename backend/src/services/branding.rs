use ::image::{Rgb, RgbImage};

/// Brand color (matches the blue from logo.svg: #2563eb)
const BRAND_BLUE: Rgb<u8> = Rgb([37, 99, 235]);
const WHITE: Rgb<u8> = Rgb([255, 255, 255]);

/// Render a house logo as a PNG image with a letter centered inside.
/// Returns raw RGB pixel data and dimensions for embedding in PDFs.
pub fn render_house_logo(letter: &str, size: u32) -> RgbImage {
    let mut img = RgbImage::from_pixel(size, size, WHITE);
    let s = size as f32;

    // Draw filled roof triangle: peak at (0.5, 0.08), base at (0.05, 0.48) to (0.95, 0.48)
    let peak_x = s * 0.5;
    let peak_y = s * 0.08;
    let base_y = s * 0.48;
    let left_x = s * 0.05;
    let right_x = s * 0.95;

    for py in (peak_y as u32)..=(base_y as u32) {
        let t = (py as f32 - peak_y) / (base_y - peak_y);
        let xl = peak_x + t * (left_x - peak_x);
        let xr = peak_x + t * (right_x - peak_x);
        for px in (xl as u32)..=(xr as u32).min(size - 1) {
            img.put_pixel(px.min(size - 1), py, BRAND_BLUE);
        }
    }

    // Draw filled house body: rect from (0.15, 0.45) to (0.85, 0.95)
    let body_left = (s * 0.15) as u32;
    let body_right = (s * 0.85) as u32;
    let body_top = (s * 0.45) as u32;
    let body_bottom = (s * 0.95) as u32;

    for py in body_top..=body_bottom.min(size - 1) {
        for px in body_left..=body_right.min(size - 1) {
            img.put_pixel(px, py, BRAND_BLUE);
        }
    }

    // Draw door area (darker blue): rect from (0.38, 0.62) to (0.62, 0.95)
    let door_color = Rgb([30, 64, 175]); // #1e40af
    let door_left = (s * 0.38) as u32;
    let door_right = (s * 0.62) as u32;
    let door_top = (s * 0.62) as u32;
    let door_bottom = (s * 0.95) as u32;

    for py in door_top..=door_bottom.min(size - 1) {
        for px in door_left..=door_right.min(size - 1) {
            img.put_pixel(px, py, door_color);
        }
    }

    // Draw letter centered in door area using a simple bitmap approach
    // For small sizes, we just draw a simple block letter
    if !letter.is_empty() {
        let ch = letter.chars().next().unwrap_or('H');
        draw_letter(&mut img, ch, size);
    }

    img
}

/// Draw a single capital letter centered in the door area of the house logo.
/// Uses simple pixel patterns that work at small sizes.
fn draw_letter(img: &mut RgbImage, ch: char, size: u32) {
    let s = size as f32;
    // Letter area: centered in door, roughly (0.42, 0.68) to (0.58, 0.90)
    let cx = (s * 0.50) as i32;
    let cy = (s * 0.76) as i32; // Centered in door area (0.62-0.95), adjusted up for optical balance
    let half_w = (s * 0.07) as i32;
    let half_h = (s * 0.09) as i32;

    // Simple approach: draw the letter as a series of rectangles
    // This gives us a clean look at any size
    let t = (s * 0.02).max(1.0) as i32; // stroke thickness

    match ch {
        'A' => {
            // Left leg, right leg, crossbar
            draw_vbar(img, cx - half_w, cy - half_h, cy + half_h, t, size);
            draw_vbar(img, cx + half_w - t, cy - half_h, cy + half_h, t, size);
            draw_hbar(img, cx - half_w, cx + half_w, cy, t, size);
            draw_hbar(img, cx - half_w, cx + half_w, cy - half_h, t, size);
        }
        'H' => {
            draw_vbar(img, cx - half_w, cy - half_h, cy + half_h, t, size);
            draw_vbar(img, cx + half_w - t, cy - half_h, cy + half_h, t, size);
            draw_hbar(img, cx - half_w, cx + half_w, cy, t, size);
        }
        'T' => {
            draw_hbar(img, cx - half_w, cx + half_w, cy - half_h, t, size);
            draw_vbar(img, cx - t / 2, cy - half_h, cy + half_h, t, size);
        }
        'M' => {
            draw_vbar(img, cx - half_w, cy - half_h, cy + half_h, t, size);
            draw_vbar(img, cx + half_w - t, cy - half_h, cy + half_h, t, size);
            draw_vbar(img, cx - t / 2, cy - half_h, cy, t, size);
            draw_hbar(img, cx - half_w, cx + half_w, cy - half_h, t, size);
        }
        _ => {
            // Fallback: draw the letter as a filled rectangle outline (like a box with the initial)
            draw_vbar(img, cx - half_w, cy - half_h, cy + half_h, t, size);
            draw_vbar(img, cx + half_w - t, cy - half_h, cy + half_h, t, size);
            draw_hbar(img, cx - half_w, cx + half_w, cy - half_h, t, size);
            draw_hbar(img, cx - half_w, cx + half_w, cy + half_h - t, t, size);
        }
    }
}

fn draw_vbar(img: &mut RgbImage, x: i32, y_top: i32, y_bottom: i32, thickness: i32, size: u32) {
    for dy in y_top..=y_bottom {
        for dx in x..x + thickness {
            if dx >= 0 && dx < size as i32 && dy >= 0 && dy < size as i32 {
                img.put_pixel(dx as u32, dy as u32, WHITE);
            }
        }
    }
}

fn draw_hbar(img: &mut RgbImage, x_left: i32, x_right: i32, y: i32, thickness: i32, size: u32) {
    for dy in y..y + thickness {
        for dx in x_left..=x_right {
            if dx >= 0 && dx < size as i32 && dy >= 0 && dy < size as i32 {
                img.put_pixel(dx as u32, dy as u32, WHITE);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_house_logo() {
        let img = render_house_logo("H", 100);
        assert_eq!(img.width(), 100);
        assert_eq!(img.height(), 100);
    }

    #[test]
    fn test_render_house_logo_small() {
        let img = render_house_logo("T", 32);
        assert_eq!(img.width(), 32);
        assert_eq!(img.height(), 32);
    }
}
