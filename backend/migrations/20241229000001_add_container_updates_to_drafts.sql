-- Add proposed container updates to item import drafts
ALTER TABLE item_import_drafts
ADD COLUMN proposed_container_updates JSONB DEFAULT NULL;
