-- sqlx:no-transaction
CREATE TABLE IF NOT EXISTS allowed_emails (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    added_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
