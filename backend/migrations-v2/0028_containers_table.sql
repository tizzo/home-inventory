-- sqlx:no-transaction
CREATE TABLE containers (
    id UUID PRIMARY KEY,
    shelf_id UUID,
    parent_container_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    label_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    CONSTRAINT container_location_check CHECK (
        (shelf_id IS NOT NULL AND parent_container_id IS NULL) OR
        (shelf_id IS NULL AND parent_container_id IS NOT NULL)
    )
);
