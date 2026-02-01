-- sqlx:no-transaction
CREATE INDEX ASYNC idx_labels_unassigned ON labels(assigned_to_type);
