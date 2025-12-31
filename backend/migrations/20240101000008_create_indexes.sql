-- Full-text search indexes (PostgreSQL only)
-- Note: DSQL doesn't support GIN indexes or pg_trgm extension
-- These will be wrapped in a conditional block

DO $$ 
BEGIN
    -- Try to create GIN indexes if pg_trgm is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE INDEX IF NOT EXISTS idx_rooms_name_trgm ON rooms USING gin(name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_rooms_description_trgm ON rooms USING gin(description gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_shelving_units_name_trgm ON shelving_units USING gin(name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_shelves_name_trgm ON shelves USING gin(name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_containers_name_trgm ON containers USING gin(name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_items_name_trgm ON items USING gin(name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_items_description_trgm ON items USING gin(description gin_trgm_ops);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- DSQL doesn't support GIN indexes, that's okay
        -- We'll use LIKE/ILIKE for search instead
        NULL;
END $$;

