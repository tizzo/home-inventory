-- sqlx:no-transaction
CREATE INDEX ASYNC idx_shelves_label_id ON shelves(label_id);
