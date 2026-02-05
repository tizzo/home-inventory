-- sqlx:no-transaction
CREATE INDEX ASYNC idx_photos_entity ON photos(entity_type, entity_id);
