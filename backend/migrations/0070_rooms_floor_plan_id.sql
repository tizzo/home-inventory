-- sqlx:no-transaction
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor_plan_id UUID;
