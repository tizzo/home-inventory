-- sqlx:no-transaction
CREATE TABLE entity_tags (
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entity_type, entity_id, tag_id)
);
