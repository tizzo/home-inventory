-- sqlx:no-transaction
CREATE INDEX ASYNC idx_contact_submissions_item_id ON contact_submissions(item_id);
