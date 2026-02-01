-- sqlx:no-transaction
CREATE INDEX ASYNC idx_item_import_drafts_created_at ON item_import_drafts(created_at);
