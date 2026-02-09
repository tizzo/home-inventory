-- sqlx:no-transaction
CREATE INDEX IF NOT EXISTS idx_rooms_floor_plan_id ON rooms(floor_plan_id);
