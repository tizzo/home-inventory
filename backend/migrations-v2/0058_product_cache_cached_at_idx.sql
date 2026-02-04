-- sqlx:no-transaction
CREATE INDEX ASYNC idx_product_cache_cached_at ON product_cache(cached_at);
