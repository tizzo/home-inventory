-- sqlx:no-transaction
CREATE INDEX ASYNC idx_rooms_label_id ON rooms(label_id);
