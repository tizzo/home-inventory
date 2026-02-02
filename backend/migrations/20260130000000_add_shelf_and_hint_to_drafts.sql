-- Make container_id nullable to support shelf-based analysis
ALTER TABLE item_import_drafts
  ALTER COLUMN container_id DROP NOT NULL;

-- Add shelf_id as alternative location
ALTER TABLE item_import_drafts
  ADD COLUMN shelf_id UUID;

-- Add hint field for user context
ALTER TABLE item_import_drafts
  ADD COLUMN hint TEXT;

-- Add check constraint: exactly one of container_id or shelf_id
ALTER TABLE item_import_drafts
  ADD CONSTRAINT draft_location_check CHECK (
    (container_id IS NOT NULL AND shelf_id IS NULL) OR
    (container_id IS NULL AND shelf_id IS NOT NULL)
  );

-- Add index for shelf_id lookups
CREATE INDEX idx_item_import_drafts_shelf_id ON item_import_drafts(shelf_id);

-- Rename column for clarity (supports both containers and shelves now)
ALTER TABLE item_import_drafts
  RENAME COLUMN proposed_container_updates TO proposed_location_updates;
