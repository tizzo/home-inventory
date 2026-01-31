-- sqlx:no-transaction
-- Labels table (pre-generated QR codes)
-- Note: No foreign key constraints for DSQL compatibility
CREATE TABLE labels (
    id UUID PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    qr_data TEXT NOT NULL UNIQUE,
    batch_id UUID,
    assigned_to_type VARCHAR(20),
    assigned_to_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_at TIMESTAMPTZ
);

CREATE INDEX ASYNC idx_labels_number ON labels(number);
CREATE INDEX ASYNC idx_labels_batch_id ON labels(batch_id);
CREATE INDEX ASYNC idx_labels_assigned ON labels(assigned_to_type, assigned_to_id);
-- Note: Removed partial index (WHERE clause) for DSQL compatibility
CREATE INDEX ASYNC idx_labels_unassigned ON labels(assigned_to_type);

