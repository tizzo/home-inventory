-- sqlx:no-transaction
CREATE INDEX ASYNC idx_audit_logs_user_id ON audit_logs(user_id);
