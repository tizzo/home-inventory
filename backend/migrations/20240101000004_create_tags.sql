-- Tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tags_name ON tags(name);

-- Entity tags junction table
-- Note: No foreign key constraints for DSQL compatibility
CREATE TABLE entity_tags (
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID NOT NULL,
    tag_id UUID NOT NULL, -- References tags(id) - enforced in application
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entity_type, entity_id, tag_id)
);

CREATE INDEX idx_entity_tags_tag_id ON entity_tags(tag_id);
CREATE INDEX idx_entity_tags_entity ON entity_tags(entity_type, entity_id);

