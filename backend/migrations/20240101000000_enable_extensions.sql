-- sqlx:no-transaction
-- Extensions migration (DSQL-compatible)
-- Note: DSQL doesn't support extensions, but the application doesn't need them:
-- - UUID generation: Uses uuid::Uuid::new_v4() in Rust code
-- - Full-text search: Uses ILIKE with regular B-tree indexes (see create_indexes migration)
-- This migration is kept for migration history but does nothing on DSQL
SELECT 1;

