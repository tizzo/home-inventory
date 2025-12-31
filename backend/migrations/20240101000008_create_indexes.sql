-- Full-text search indexes (PostgreSQL only)
-- Note: DSQL doesn't support GIN indexes or pg_trgm extension
-- This migration will be skipped on DSQL - use LIKE/ILIKE for search instead

CREATE INDEX IF NOT EXISTS idx_rooms_name_trgm ON rooms USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_rooms_description_trgm ON rooms USING gin(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shelving_units_name_trgm ON shelving_units USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shelves_name_trgm ON shelves USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_containers_name_trgm ON containers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_name_trgm ON items USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_description_trgm ON items USING gin(description gin_trgm_ops);

