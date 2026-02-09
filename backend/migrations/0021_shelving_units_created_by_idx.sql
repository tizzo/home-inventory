-- sqlx:no-transaction
CREATE INDEX ASYNC idx_shelving_units_created_by ON shelving_units(created_by);
