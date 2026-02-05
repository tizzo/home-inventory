-- sqlx:no-transaction
CREATE INDEX ASYNC idx_item_import_drafts_container_id ON item_import_drafts(container_id);
