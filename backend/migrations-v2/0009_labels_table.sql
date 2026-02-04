-- sqlx:no-transaction
CREATE TABLE labels (
    id UUID PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    qr_data TEXT NOT NULL UNIQUE,
    batch_id UUID,
    assigned_to_type VARCHAR(20),
    assigned_to_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_at TIMESTAMPTZ
);
