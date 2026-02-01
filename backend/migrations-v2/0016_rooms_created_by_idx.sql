-- sqlx:no-transaction
CREATE INDEX ASYNC idx_rooms_created_by ON rooms(created_by);
