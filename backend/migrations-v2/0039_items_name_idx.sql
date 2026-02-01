-- sqlx:no-transaction
CREATE INDEX ASYNC idx_items_name ON items(name);
