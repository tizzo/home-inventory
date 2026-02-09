-- sqlx:no-transaction
CREATE INDEX ASYNC idx_sessions_user_id ON sessions(user_id);
