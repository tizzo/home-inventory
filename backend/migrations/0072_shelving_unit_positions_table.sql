-- sqlx:no-transaction
CREATE TABLE IF NOT EXISTS shelving_unit_positions (
    id UUID PRIMARY KEY,
    floor_plan_id UUID NOT NULL,
    shelving_unit_id UUID NOT NULL,
    x_percent DECIMAL(5,2) NOT NULL,
    y_percent DECIMAL(5,2) NOT NULL,
    rotation_degrees INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);
