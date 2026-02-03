-- sqlx:no-transaction
-- Shelving unit positions on floor plans
-- Stores x,y coordinates as percentages (0-100) for responsive positioning
-- Each shelving unit can only be placed once per floor plan

CREATE TABLE shelving_unit_positions (
    id UUID PRIMARY KEY,
    floor_plan_id UUID NOT NULL,
    shelving_unit_id UUID NOT NULL,
    x_percent DECIMAL(5,2) NOT NULL,
    y_percent DECIMAL(5,2) NOT NULL,
    rotation_degrees INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE UNIQUE INDEX ASYNC idx_unit_positions_unique ON shelving_unit_positions(floor_plan_id, shelving_unit_id);
CREATE INDEX ASYNC idx_unit_positions_floor_plan ON shelving_unit_positions(floor_plan_id);
CREATE INDEX ASYNC idx_unit_positions_unit ON shelving_unit_positions(shelving_unit_id);
