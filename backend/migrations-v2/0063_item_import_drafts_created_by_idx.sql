-- sqlx:no-transaction
CREATE INDEX ASYNC idx_item_import_drafts_created_by ON item_import_drafts(created_by);
