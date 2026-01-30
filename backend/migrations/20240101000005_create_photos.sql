-- sqlx:no-transaction
-- Photos table
-- Note: No foreign key constraints for DSQL compatibility
CREATE TABLE photos (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    thumbnail_s3_key VARCHAR(500),
    content_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL -- References users(id) - enforced in application
);

CREATE INDEX ASYNC idx_photos_entity ON photos(entity_type, entity_id);
CREATE INDEX ASYNC idx_photos_created_by ON photos(created_by);
CREATE INDEX ASYNC idx_photos_created_at ON photos(created_at);

