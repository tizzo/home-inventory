use ::image::{Rgb, RgbImage};

/// Brand color (matches the blue from logo.svg: #2563eb)
const BRAND_BLUE: Rgb<u8> = Rgb([37, 99, 235]);
const WHITE: Rgb<u8> = Rgb([255, 255, 255]);

/// Check if a point is inside the house silhouette (roof triangle + body rect).
fn is_inside_house(px: f32, py: f32, s: f32) -> bool {
    // Roof triangle: peak at (0.5, 0.08), base at (0.05, 0.48) to (0.95, 0.48)
    let peak_x = s * 0.5;
    let peak_y = s * 0.08;
    let base_y = s * 0.48;
    let left_x = s * 0.05;
    let right_x = s * 0.95;

    let in_roof = if py >= peak_y && py <= base_y {
        let t = (py - peak_y) / (base_y - peak_y);
        let xl = peak_x + t * (left_x - peak_x);
        let xr = peak_x + t * (right_x - peak_x);
        px >= xl && px <= xr
    } else {
        false
    };

    // Body rect: (0.15, 0.45) to (0.85, 0.95)
    let in_body = px >= s * 0.15 && px <= s * 0.85 && py >= s * 0.45 && py <= s * 0.95;

    in_roof || in_body
}

/// Render a house logo as a PNG image with a letter centered on the house body.
/// The house is a solid blue silhouette (roof + body, no door) with a white stroke
/// outline, and the letter is drawn large and white directly on the house.
/// The background is transparent (white, to blend with QR codes).
pub fn render_house_logo(letter: &str, size: u32) -> RgbImage {
    let mut img = RgbImage::from_pixel(size, size, WHITE);
    let s = size as f32;

    let stroke = (s * 0.04).max(1.0);

    // Draw white stroke outline first (pixels near the edge of the house shape)
    for py in 0..size {
        for px in 0..size {
            let fpx = px as f32;
            let fpy = py as f32;
            if !is_inside_house(fpx, fpy, s) {
                // Check if any neighbor within stroke distance is inside the house
                let mut near_house = false;
                let steps = (stroke.ceil() as i32) + 1;
                'outer: for dy in -steps..=steps {
                    for dx in -steps..=steps {
                        let nx = fpx + dx as f32;
                        let ny = fpy + dy as f32;
                        if (dx as f32).hypot(dy as f32) <= stroke && is_inside_house(nx, ny, s) {
                            near_house = true;
                            break 'outer;
                        }
                    }
                }
                if near_house {
                    img.put_pixel(px, py, WHITE);
                }
            }
        }
    }

    // Draw filled house silhouette (roof + body, single color, no door)
    for py in 0..size {
        for px in 0..size {
            if is_inside_house(px as f32, py as f32, s) {
                img.put_pixel(px, py, BRAND_BLUE);
            }
        }
    }

    // Draw letter centered on the house body (larger, no door box)
    // Letter area: centered roughly at (0.5, 0.72), bigger than before
    if !letter.is_empty() {
        let ch = letter.chars().next().unwrap_or('H');
        draw_letter(&mut img, ch, size);
    }

    img
}

/// Draw a single capital letter centered on the house body.
/// Uses simple pixel patterns - larger than before for visibility.
fn draw_letter(img: &mut RgbImage, ch: char, size: u32) {
    let s = size as f32;
    let cx = (s * 0.50) as i32;
    let cy = (s * 0.72) as i32;
    let half_w = (s * 0.10) as i32;
    let half_h = (s * 0.13) as i32;
    let t = (s * 0.03).max(1.0) as i32; // stroke thickness

    match ch {
        'A' => {
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
