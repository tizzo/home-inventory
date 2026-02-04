-- sqlx:no-transaction
CREATE INDEX ASYNC idx_audit_logs_action ON audit_logs(action);
