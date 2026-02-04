-- sqlx:no-transaction
CREATE INDEX ASYNC idx_audit_logs_created_at ON audit_logs(created_at);
