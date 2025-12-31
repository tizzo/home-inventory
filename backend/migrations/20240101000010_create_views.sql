-- Views (PostgreSQL only)
-- Note: DSQL doesn't support views
-- We'll implement these as repository functions for DSQL

DO $$ 
BEGIN
    -- View for label assignment status
    CREATE OR REPLACE VIEW label_status AS
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
    CREATE OR REPLACE VIEW item_hierarchy AS
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
EXCEPTION
    WHEN OTHERS THEN
        -- DSQL doesn't support views, that's okay
        -- We'll implement these as repository functions
        NULL;
END $$;

-- Add comments for documentation (PostgreSQL only)
DO $$ 
BEGIN
    COMMENT ON TABLE labels IS 'Pre-generated QR code labels with generic numbers (#1, #2, etc)';
    COMMENT ON TABLE audit_logs IS 'Complete audit trail of all entity changes';
    COMMENT ON TABLE sessions IS 'User sessions for cookie-based authentication';
    COMMENT ON TABLE product_cache IS 'Cached barcode lookup results to reduce API calls';
    COMMENT ON COLUMN containers.parent_container_id IS 'Allows containers to nest within other containers';
    COMMENT ON COLUMN items.barcode IS 'UPC/EAN barcode for product identification';
EXCEPTION
    WHEN OTHERS THEN
        -- DSQL might not support comments, that's okay
        NULL;
END $$;

