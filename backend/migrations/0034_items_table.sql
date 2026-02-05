-- sqlx:no-transaction
CREATE TABLE items (
    id UUID PRIMARY KEY,
    shelf_id UUID,
    container_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    barcode VARCHAR(50),
    barcode_type VARCHAR(20),
    label_id UUID,
    product_manual_s3_key VARCHAR(500),
    receipt_s3_key VARCHAR(500),
    product_link TEXT,
    belongs_to_user_id UUID,
    acquired_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    CONSTRAINT item_location_check CHECK (
        (shelf_id IS NOT NULL AND container_id IS NULL) OR
        (shelf_id IS NULL AND container_id IS NOT NULL)
    )
);
