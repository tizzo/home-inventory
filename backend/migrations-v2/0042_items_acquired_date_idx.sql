-- sqlx:no-transaction
CREATE INDEX ASYNC idx_items_acquired_date ON items(acquired_date);
