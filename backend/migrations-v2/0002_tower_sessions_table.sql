-- sqlx:no-transaction
CREATE TABLE IF NOT EXISTS tower_sessions.session (
    id TEXT PRIMARY KEY NOT NULL,
    data BYTEA NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL
);
