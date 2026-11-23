-- sqlx:no-transaction
CREATE TABLE shelving_unit_positions (
    shelving_unit_id UUID PRIMARY KEY,
    x_percent DOUBLE PRECISION NOT NULL,
    y_percent DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);
