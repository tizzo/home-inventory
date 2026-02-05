-- sqlx:no-transaction
CREATE INDEX IF NOT EXISTS idx_floor_plans_created_by ON floor_plans(created_by);
