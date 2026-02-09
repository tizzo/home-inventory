-- sqlx:no-transaction
CREATE INDEX ASYNC idx_labels_batch_id ON labels(batch_id);
