-- sqlx:no-transaction
-- Add floor_plan_id to rooms table
-- Allows rooms to be linked to a floor plan for visual positioning

ALTER TABLE rooms ADD COLUMN floor_plan_id UUID;

CREATE INDEX ASYNC idx_rooms_floor_plan_id ON rooms(floor_plan_id);
