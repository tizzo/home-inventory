-- sqlx:no-transaction
CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_positions_unique ON shelving_unit_positions(floor_plan_id, shelving_unit_id);
