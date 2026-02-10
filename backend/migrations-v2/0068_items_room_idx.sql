-- sqlx:no-transaction
CREATE INDEX ASYNC idx_items_room_id ON items(room_id);
