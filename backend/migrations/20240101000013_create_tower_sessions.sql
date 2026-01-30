-- sqlx:no-transaction
-- Tower sessions schema and table
-- Note: DSQL requires these to be created separately (not in a transaction)
-- This migration must be run manually for DSQL deployments

-- Create tower_sessions schema
CREATE SCHEMA IF NOT EXISTS tower_sessions;

-- Create sessions table
-- Used by tower-sessions-sqlx-store for session storage
CREATE TABLE IF NOT EXISTS tower_sessions.session (
    id TEXT PRIMARY KEY NOT NULL,
    data BYTEA NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL
);
