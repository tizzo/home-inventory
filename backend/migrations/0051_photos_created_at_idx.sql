-- sqlx:no-transaction
CREATE INDEX ASYNC idx_photos_created_at ON photos(created_at);
