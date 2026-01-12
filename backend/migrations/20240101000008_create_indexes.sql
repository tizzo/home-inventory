-- Search indexes (DSQL-compatible)
-- Note: DSQL doesn't support GIN indexes, so we use regular B-tree indexes
-- These indexes support ILIKE queries (case-insensitive pattern matching)
-- Performance: ILIKE with B-tree indexes is slower than GIN+pg_trgm but still functional
-- Regular indexes on name columns already exist in create_hierarchy migration
-- This migration is kept for migration history but does nothing on DSQL
SELECT 1;

