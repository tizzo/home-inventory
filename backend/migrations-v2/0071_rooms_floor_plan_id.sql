-- sqlx:no-transaction
ALTER TABLE rooms ADD COLUMN floor_plan_id UUID;
