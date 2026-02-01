-- sqlx:no-transaction
CREATE INDEX ASYNC idx_shelving_units_name ON shelving_units(name);
