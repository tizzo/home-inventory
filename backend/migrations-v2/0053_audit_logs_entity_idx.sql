-- sqlx:no-transaction
CREATE INDEX ASYNC idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
