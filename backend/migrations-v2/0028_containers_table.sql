-- sqlx:no-transaction
CREATE TABLE containers (
    id UUID PRIMARY KEY,
    shelf_id UUID,
    parent_container_id UUID,
    room_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    label_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);
