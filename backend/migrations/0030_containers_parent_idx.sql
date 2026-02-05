-- sqlx:no-transaction
CREATE INDEX ASYNC idx_containers_parent_id ON containers(parent_container_id);
