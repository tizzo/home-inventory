-- sqlx:no-transaction
CREATE TABLE item_import_drafts (
    id UUID PRIMARY KEY,
    container_id UUID,
    room_id UUID,
    status VARCHAR(20) NOT NULL,
    proposed_items TEXT NOT NULL,
    proposed_container_updates TEXT,
    source_photo_ids TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL
);
