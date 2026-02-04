-- sqlx:no-transaction
CREATE INDEX ASYNC idx_rooms_name ON rooms(name);
