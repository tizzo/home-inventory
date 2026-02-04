-- sqlx:no-transaction
CREATE INDEX ASYNC idx_items_container_id ON items(container_id);
