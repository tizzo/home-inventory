-- sqlx:no-transaction
CREATE INDEX IF NOT EXISTS idx_unit_positions_floor_plan ON shelving_unit_positions(floor_plan_id);
