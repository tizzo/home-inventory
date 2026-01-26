-- Add public_display_name for public item views
ALTER TABLE users ADD COLUMN public_display_name VARCHAR(255);
