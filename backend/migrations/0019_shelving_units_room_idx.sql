-- sqlx:no-transaction
CREATE INDEX ASYNC idx_shelving_units_room_id ON shelving_units(room_id);
