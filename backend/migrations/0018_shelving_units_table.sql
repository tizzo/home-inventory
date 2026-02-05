-- sqlx:no-transaction
CREATE TABLE shelving_units (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    label_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);
