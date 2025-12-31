-- Product cache table (for barcode lookups)
CREATE TABLE product_cache (
    barcode VARCHAR(50) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    brand VARCHAR(255),
    image_url TEXT,
    source VARCHAR(50) NOT NULL,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_cache_cached_at ON product_cache(cached_at);

