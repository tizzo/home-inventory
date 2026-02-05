-- sqlx:no-transaction
CREATE INDEX ASYNC idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
