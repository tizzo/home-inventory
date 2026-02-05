-- sqlx:no-transaction
CREATE INDEX ASYNC idx_users_google_id ON users(google_id);
