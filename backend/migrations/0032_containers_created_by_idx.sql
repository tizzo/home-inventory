-- sqlx:no-transaction
CREATE INDEX ASYNC idx_containers_created_by ON containers(created_by);
