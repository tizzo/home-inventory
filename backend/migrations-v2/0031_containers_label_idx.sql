-- sqlx:no-transaction
CREATE INDEX ASYNC idx_containers_label_id ON containers(label_id);
