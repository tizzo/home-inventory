-- sqlx:no-transaction
CREATE INDEX IF NOT EXISTS idx_unit_positions_unit ON shelving_unit_positions(shelving_unit_id);
