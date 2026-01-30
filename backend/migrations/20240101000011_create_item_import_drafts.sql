-- sqlx:no-transaction
-- Item import drafts table
-- Note: Using TEXT for JSON data - DSQL doesn't support JSON/JSONB datatypes
-- Application code handles JSON serialization/deserialization
CREATE TABLE item_import_drafts (
    id UUID PRIMARY KEY,
    container_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    proposed_items TEXT NOT NULL,
    source_photo_ids TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE INDEX ASYNC idx_item_import_drafts_container_id ON item_import_drafts(container_id);
CREATE INDEX ASYNC idx_item_import_drafts_status ON item_import_drafts(status);
CREATE INDEX ASYNC idx_item_import_drafts_created_at ON item_import_drafts(created_at);
CREATE INDEX ASYNC idx_item_import_drafts_created_by ON item_import_drafts(created_by);
