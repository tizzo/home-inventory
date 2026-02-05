-- sqlx:no-transaction
CREATE TABLE shelves (
    id UUID PRIMARY KEY,
    shelving_unit_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER,
    label_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);
