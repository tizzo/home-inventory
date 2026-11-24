-- sqlx:no-transaction
CREATE INDEX ASYNC idx_rooms_floor_plan_id ON rooms(floor_plan_id);
