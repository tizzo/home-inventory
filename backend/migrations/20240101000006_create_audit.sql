-- Audit logs table
-- Note: No foreign key constraints for DSQL compatibility
-- Note: Using JSON instead of JSONB for DSQL compatibility
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    user_id UUID, -- References users(id) - enforced in application
    changes JSON,
    metadata JSON,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX ASYNC idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX ASYNC idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX ASYNC idx_audit_logs_action ON audit_logs(action);

