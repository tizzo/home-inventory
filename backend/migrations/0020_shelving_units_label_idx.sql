-- sqlx:no-transaction
CREATE INDEX ASYNC idx_shelving_units_label_id ON shelving_units(label_id);
