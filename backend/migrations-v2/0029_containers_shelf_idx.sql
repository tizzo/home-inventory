-- sqlx:no-transaction
CREATE INDEX ASYNC idx_containers_shelf_id ON containers(shelf_id);
