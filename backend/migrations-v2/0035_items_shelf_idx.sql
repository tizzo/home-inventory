-- sqlx:no-transaction
CREATE INDEX ASYNC idx_items_shelf_id ON items(shelf_id);
