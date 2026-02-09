-- sqlx:no-transaction
CREATE INDEX ASYNC idx_item_import_drafts_status ON item_import_drafts(status);
