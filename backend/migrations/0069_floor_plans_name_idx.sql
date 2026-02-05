-- sqlx:no-transaction
CREATE INDEX IF NOT EXISTS idx_floor_plans_name ON floor_plans(name);
