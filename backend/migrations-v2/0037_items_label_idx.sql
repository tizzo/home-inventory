-- sqlx:no-transaction
CREATE INDEX ASYNC idx_items_label_id ON items(label_id);
