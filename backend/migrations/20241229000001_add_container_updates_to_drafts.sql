-- sqlx:no-transaction
-- Add proposed container updates to item import drafts
-- Note: Using TEXT instead of JSONB for DSQL compatibility
-- Note: DSQL doesn't support ADD COLUMN with DEFAULT constraint, column will be nullable by default
ALTER TABLE item_import_drafts
ADD COLUMN proposed_container_updates TEXT;
