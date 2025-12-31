-- Enable UUID and pg_trgm extensions (PostgreSQL only)
-- DSQL will ignore these and use application-generated UUIDs

-- Check if we're on PostgreSQL by attempting to create extensions
-- DSQL will fail silently or skip unsupported statements
DO $$ 
BEGIN
    -- Try to enable uuid-ossp extension
    IF EXISTS (
        SELECT 1 FROM pg_available_extensions WHERE name = 'uuid-ossp'
    ) THEN
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- DSQL doesn't support extensions, that's okay
        NULL;
END $$;

DO $$ 
BEGIN
    -- Try to enable pg_trgm extension for fuzzy search
    IF EXISTS (
        SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm'
    ) THEN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- DSQL doesn't support extensions, that's okay
        NULL;
END $$;

