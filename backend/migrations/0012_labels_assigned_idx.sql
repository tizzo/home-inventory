-- sqlx:no-transaction
CREATE INDEX ASYNC idx_labels_assigned ON labels(assigned_to_type, assigned_to_id);
