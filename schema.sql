-- Home Inventory Database Schema
-- PostgreSQL / Aurora DSQL compatible

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    cognito_sub VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cognito_sub ON users(cognito_sub);

-- Sessions table (for cookie-based auth)
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Labels table (pre-generated QR codes)
CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number INTEGER NOT NULL UNIQUE, -- Sequential: #1, #2, #3...
    qr_data TEXT NOT NULL UNIQUE, -- URL: https://app.domain.com/l/{id}
    batch_id UUID, -- Group labels printed together
    assigned_to_type VARCHAR(20), -- 'room', 'unit', 'shelf', 'container', 'item', NULL if unassigned
    assigned_to_id UUID, -- Foreign key to specific entity
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_at TIMESTAMPTZ
);

CREATE INDEX idx_labels_number ON labels(number);
CREATE INDEX idx_labels_batch_id ON labels(batch_id);
CREATE INDEX idx_labels_assigned ON labels(assigned_to_type, assigned_to_id);
CREATE INDEX idx_labels_unassigned ON labels(assigned_to_type) WHERE assigned_to_type IS NULL;

-- Rooms table (top level)
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    label_id UUID REFERENCES labels(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_rooms_label_id ON rooms(label_id);
CREATE INDEX idx_rooms_created_by ON rooms(created_by);
CREATE INDEX idx_rooms_name ON rooms(name);

-- Shelving units table
CREATE TABLE shelving_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    label_id UUID REFERENCES labels(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_shelving_units_room_id ON shelving_units(room_id);
CREATE INDEX idx_shelving_units_label_id ON shelving_units(label_id);
CREATE INDEX idx_shelving_units_created_by ON shelving_units(created_by);
CREATE INDEX idx_shelving_units_name ON shelving_units(name);

-- Shelves table
CREATE TABLE shelves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelving_unit_id UUID NOT NULL REFERENCES shelving_units(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER, -- Order within unit (1=top, 2=second, etc)
    label_id UUID REFERENCES labels(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_shelves_unit_id ON shelves(shelving_unit_id);
CREATE INDEX idx_shelves_label_id ON shelves(label_id);
CREATE INDEX idx_shelves_created_by ON shelves(created_by);
CREATE INDEX idx_shelves_position ON shelves(shelving_unit_id, position);

-- Containers table (can nest)
CREATE TABLE containers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelf_id UUID REFERENCES shelves(id) ON DELETE CASCADE, -- NULL if in another container
    parent_container_id UUID REFERENCES containers(id) ON DELETE CASCADE, -- NULL if on shelf
    name VARCHAR(255) NOT NULL,
    description TEXT,
    label_id UUID REFERENCES labels(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    CONSTRAINT container_location_check CHECK (
        (shelf_id IS NOT NULL AND parent_container_id IS NULL) OR
        (shelf_id IS NULL AND parent_container_id IS NOT NULL)
    )
);

CREATE INDEX idx_containers_shelf_id ON containers(shelf_id);
CREATE INDEX idx_containers_parent_id ON containers(parent_container_id);
CREATE INDEX idx_containers_label_id ON containers(label_id);
CREATE INDEX idx_containers_created_by ON containers(created_by);
CREATE INDEX idx_containers_name ON containers(name);

-- Items table
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shelf_id UUID REFERENCES shelves(id) ON DELETE CASCADE, -- NULL if in container
    container_id UUID REFERENCES containers(id) ON DELETE CASCADE, -- NULL if on shelf
    name VARCHAR(255) NOT NULL,
    description TEXT,
    barcode VARCHAR(50), -- UPC/EAN barcode
    barcode_type VARCHAR(20), -- 'UPC_A', 'EAN_13', etc.
    label_id UUID REFERENCES labels(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    CONSTRAINT item_location_check CHECK (
        (shelf_id IS NOT NULL AND container_id IS NULL) OR
        (shelf_id IS NULL AND container_id IS NOT NULL)
    )
);

CREATE INDEX idx_items_shelf_id ON items(shelf_id);
CREATE INDEX idx_items_container_id ON items(container_id);
CREATE INDEX idx_items_label_id ON items(label_id);
CREATE INDEX idx_items_barcode ON items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_items_created_by ON items(created_by);
CREATE INDEX idx_items_name ON items(name);

-- Tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tags_name ON tags(name);

-- Entity tags junction table
CREATE TABLE entity_tags (
    entity_type VARCHAR(20) NOT NULL, -- 'room', 'unit', 'shelf', 'container', 'item'
    entity_id UUID NOT NULL,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entity_type, entity_id, tag_id)
);

CREATE INDEX idx_entity_tags_tag_id ON entity_tags(tag_id);
CREATE INDEX idx_entity_tags_entity ON entity_tags(entity_type, entity_id);

-- Photos table
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(20) NOT NULL, -- 'room', 'unit', 'shelf', 'container', 'item'
    entity_id UUID NOT NULL,
    s3_key VARCHAR(500) NOT NULL, -- Full resolution image
    thumbnail_s3_key VARCHAR(500), -- Thumbnail image
    content_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_photos_entity ON photos(entity_type, entity_id);
CREATE INDEX idx_photos_created_by ON photos(created_by);
CREATE INDEX idx_photos_created_at ON photos(created_at);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(20) NOT NULL, -- 'room', 'unit', 'shelf', 'container', 'item', 'label'
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete', 'move', 'assign_label'
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    changes JSONB, -- Before/after state for updates
    metadata JSONB, -- Additional context (e.g., old location for moves)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Product cache table (for barcode lookups)
CREATE TABLE product_cache (
    barcode VARCHAR(50) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    brand VARCHAR(255),
    image_url TEXT,
    source VARCHAR(50) NOT NULL, -- 'open_food_facts', 'upcitemdb', etc.
    cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_cache_cached_at ON product_cache(cached_at);

-- Full-text search indexes (PostgreSQL)
CREATE INDEX idx_rooms_name_trgm ON rooms USING gin(name gin_trgm_ops);
CREATE INDEX idx_rooms_description_trgm ON rooms USING gin(description gin_trgm_ops);
CREATE INDEX idx_shelving_units_name_trgm ON shelving_units USING gin(name gin_trgm_ops);
CREATE INDEX idx_shelves_name_trgm ON shelves USING gin(name gin_trgm_ops);
CREATE INDEX idx_containers_name_trgm ON containers USING gin(name gin_trgm_ops);
CREATE INDEX idx_items_name_trgm ON items USING gin(name gin_trgm_ops);
CREATE INDEX idx_items_description_trgm ON items USING gin(description gin_trgm_ops);

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shelving_units_updated_at BEFORE UPDATE ON shelving_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shelves_updated_at BEFORE UPDATE ON shelves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_containers_updated_at BEFORE UPDATE ON containers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for label assignment status
CREATE VIEW label_status AS
SELECT 
    l.id,
    l.number,
    l.assigned_to_type,
    l.assigned_to_id,
    l.batch_id,
    CASE 
        WHEN l.assigned_to_type = 'room' THEN r.name
        WHEN l.assigned_to_type = 'unit' THEN u.name
        WHEN l.assigned_to_type = 'shelf' THEN s.name
        WHEN l.assigned_to_type = 'container' THEN c.name
        WHEN l.assigned_to_type = 'item' THEN i.name
        ELSE NULL
    END as assigned_to_name,
    l.assigned_at,
    l.created_at
FROM labels l
LEFT JOIN rooms r ON l.assigned_to_type = 'room' AND l.assigned_to_id = r.id
LEFT JOIN shelving_units u ON l.assigned_to_type = 'unit' AND l.assigned_to_id = u.id
LEFT JOIN shelves s ON l.assigned_to_type = 'shelf' AND l.assigned_to_id = s.id
LEFT JOIN containers c ON l.assigned_to_type = 'container' AND l.assigned_to_id = c.id
LEFT JOIN items i ON l.assigned_to_type = 'item' AND l.assigned_to_id = i.id;

-- View for full item hierarchy
CREATE VIEW item_hierarchy AS
SELECT 
    i.id,
    i.name,
    i.description,
    i.barcode,
    i.label_id,
    c.name as container_name,
    c.id as container_id,
    s.name as shelf_name,
    s.id as shelf_id,
    u.name as unit_name,
    u.id as unit_id,
    r.name as room_name,
    r.id as room_id
FROM items i
LEFT JOIN containers c ON i.container_id = c.id
LEFT JOIN shelves s ON COALESCE(i.shelf_id, c.shelf_id) = s.id
LEFT JOIN shelving_units u ON s.shelving_unit_id = u.id
LEFT JOIN rooms r ON u.room_id = r.id;

-- Comments for documentation
COMMENT ON TABLE labels IS 'Pre-generated QR code labels with generic numbers (#1, #2, etc)';
COMMENT ON TABLE audit_logs IS 'Complete audit trail of all entity changes';
COMMENT ON TABLE sessions IS 'User sessions for cookie-based authentication';
COMMENT ON TABLE product_cache IS 'Cached barcode lookup results to reduce API calls';
COMMENT ON COLUMN containers.parent_container_id IS 'Allows containers to nest within other containers';
COMMENT ON COLUMN items.barcode IS 'UPC/EAN barcode for product identification';
