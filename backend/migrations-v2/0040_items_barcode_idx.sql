-- sqlx:no-transaction
CREATE INDEX ASYNC idx_items_barcode ON items(barcode);
