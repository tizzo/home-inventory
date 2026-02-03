-- sqlx:no-transaction
-- Floor plans table
-- Stores floor plan images for building floors (not individual rooms)
-- Multiple rooms can be linked to a single floor plan

CREATE TABLE floor_plans (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    s3_key VARCHAR(500) NOT NULL,
    thumbnail_s3_key VARCHAR(500),
    content_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE INDEX ASYNC idx_floor_plans_created_by ON floor_plans(created_by);
CREATE INDEX ASYNC idx_floor_plans_name ON floor_plans(name);
