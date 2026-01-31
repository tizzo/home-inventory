-- sqlx:no-transaction
-- Updated_at triggers (DSQL-compatible)
-- Note: DSQL doesn't support triggers
-- Application code manually sets updated_at = NOW() in all UPDATE queries
-- This migration is kept for migration history but does nothing on DSQL
SELECT 1;

