-- sqlx:no-transaction
CREATE INDEX ASYNC idx_items_created_by ON items(created_by);
