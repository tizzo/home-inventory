-- sqlx:no-transaction
CREATE INDEX ASYNC idx_shelves_position ON shelves(shelving_unit_id, position);
