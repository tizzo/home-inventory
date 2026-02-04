-- sqlx:no-transaction
CREATE INDEX ASYNC idx_sessions_expires_at ON sessions(expires_at);
