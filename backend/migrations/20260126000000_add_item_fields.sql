-- Add new fields to items table for enhanced functionality
ALTER TABLE items ADD COLUMN product_manual_s3_key VARCHAR(500);
ALTER TABLE items ADD COLUMN receipt_s3_key VARCHAR(500);
ALTER TABLE items ADD COLUMN product_link TEXT;
ALTER TABLE items ADD COLUMN belongs_to_user_id UUID;
ALTER TABLE items ADD COLUMN acquired_date DATE;

-- Add foreign key constraint for belongs_to_user_id
ALTER TABLE items ADD CONSTRAINT fk_items_belongs_to_user
    FOREIGN KEY (belongs_to_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add indexes for efficient querying
CREATE INDEX idx_items_belongs_to ON items(belongs_to_user_id);
CREATE INDEX idx_items_acquired_date ON items(acquired_date);
