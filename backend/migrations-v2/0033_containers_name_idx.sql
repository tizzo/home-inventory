-- sqlx:no-transaction
CREATE INDEX ASYNC idx_containers_name ON containers(name);
