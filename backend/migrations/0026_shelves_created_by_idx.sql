-- sqlx:no-transaction
CREATE INDEX ASYNC idx_shelves_created_by ON shelves(created_by);
