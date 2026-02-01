-- sqlx:no-transaction
CREATE INDEX ASYNC idx_tags_name ON tags(name);
