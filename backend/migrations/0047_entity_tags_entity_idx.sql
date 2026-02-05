-- sqlx:no-transaction
CREATE INDEX ASYNC idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
