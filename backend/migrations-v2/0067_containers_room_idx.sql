-- sqlx:no-transaction
CREATE INDEX ASYNC idx_containers_room_id ON containers(room_id);
