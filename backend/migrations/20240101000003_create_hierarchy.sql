-- Rooms table (top level)
-- Note: No foreign key constraints for DSQL compatibility
CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    label_id UUID, -- References labels(id) - enforced in application
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL -- References users(id) - enforced in application
);

CREATE INDEX ASYNC idx_rooms_label_id ON rooms(label_id);
CREATE INDEX ASYNC idx_rooms_created_by ON rooms(created_by);
CREATE INDEX ASYNC idx_rooms_name ON rooms(name);

-- Shelving units table
CREATE TABLE shelving_units (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL, -- References rooms(id) - enforced in application
    name VARCHAR(255) NOT NULL,
    description TEXT,
    label_id UUID, -- References labels(id) - enforced in application
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL -- References users(id) - enforced in application
);

CREATE INDEX ASYNC idx_shelving_units_room_id ON shelving_units(room_id);
CREATE INDEX ASYNC idx_shelving_units_label_id ON shelving_units(label_id);
CREATE INDEX ASYNC idx_shelving_units_created_by ON shelving_units(created_by);
CREATE INDEX ASYNC idx_shelving_units_name ON shelving_units(name);

-- Shelves table
CREATE TABLE shelves (
    id UUID PRIMARY KEY,
    shelving_unit_id UUID NOT NULL, -- References shelving_units(id) - enforced in application
    name VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER,
    label_id UUID, -- References labels(id) - enforced in application
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL -- References users(id) - enforced in application
);

CREATE INDEX ASYNC idx_shelves_unit_id ON shelves(shelving_unit_id);
CREATE INDEX ASYNC idx_shelves_label_id ON shelves(label_id);
CREATE INDEX ASYNC idx_shelves_created_by ON shelves(created_by);
CREATE INDEX ASYNC idx_shelves_position ON shelves(shelving_unit_id, position);

-- Containers table (can nest)
CREATE TABLE containers (
    id UUID PRIMARY KEY,
    shelf_id UUID, -- References shelves(id) - enforced in application
    parent_container_id UUID, -- References containers(id) - enforced in application
    name VARCHAR(255) NOT NULL,
    description TEXT,
    label_id UUID, -- References labels(id) - enforced in application
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL, -- References users(id) - enforced in application
    CONSTRAINT container_location_check CHECK (
        (shelf_id IS NOT NULL AND parent_container_id IS NULL) OR
        (shelf_id IS NULL AND parent_container_id IS NOT NULL)
    )
);

CREATE INDEX ASYNC idx_containers_shelf_id ON containers(shelf_id);
CREATE INDEX ASYNC idx_containers_parent_id ON containers(parent_container_id);
CREATE INDEX ASYNC idx_containers_label_id ON containers(label_id);
CREATE INDEX ASYNC idx_containers_created_by ON containers(created_by);
CREATE INDEX ASYNC idx_containers_name ON containers(name);

-- Items table
CREATE TABLE items (
    id UUID PRIMARY KEY,
    shelf_id UUID, -- References shelves(id) - enforced in application
    container_id UUID, -- References containers(id) - enforced in application
    name VARCHAR(255) NOT NULL,
    description TEXT,
    barcode VARCHAR(50),
    barcode_type VARCHAR(20),
    label_id UUID, -- References labels(id) - enforced in application
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL, -- References users(id) - enforced in application
    CONSTRAINT item_location_check CHECK (
        (shelf_id IS NOT NULL AND container_id IS NULL) OR
        (shelf_id IS NULL AND container_id IS NOT NULL)
    )
);

CREATE INDEX ASYNC idx_items_shelf_id ON items(shelf_id);
CREATE INDEX ASYNC idx_items_container_id ON items(container_id);
CREATE INDEX ASYNC idx_items_label_id ON items(label_id);
CREATE INDEX ASYNC idx_items_created_by ON items(created_by);
CREATE INDEX ASYNC idx_items_name ON items(name);
-- Note: Removed partial index (WHERE clause) for DSQL compatibility
CREATE INDEX ASYNC idx_items_barcode ON items(barcode);

