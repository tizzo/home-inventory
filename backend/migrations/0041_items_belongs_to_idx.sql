-- sqlx:no-transaction
CREATE INDEX ASYNC idx_items_belongs_to ON items(belongs_to_user_id);
