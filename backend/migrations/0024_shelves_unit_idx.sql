-- sqlx:no-transaction
CREATE INDEX ASYNC idx_shelves_unit_id ON shelves(shelving_unit_id);
