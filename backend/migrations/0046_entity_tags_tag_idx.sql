-- sqlx:no-transaction
CREATE INDEX ASYNC idx_entity_tags_tag_id ON entity_tags(tag_id);
