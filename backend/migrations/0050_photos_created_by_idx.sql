-- sqlx:no-transaction
CREATE INDEX ASYNC idx_photos_created_by ON photos(created_by);
