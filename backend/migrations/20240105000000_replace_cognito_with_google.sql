-- sqlx:no-transaction
-- Rename cognito_sub to google_id
-- Note: DSQL doesn't support DROP/ADD CONSTRAINT, but the UNIQUE constraint
-- defined in the original table creation will automatically be renamed with the column
ALTER TABLE users RENAME COLUMN cognito_sub TO google_id;

-- Rename index (created in migration 20240101000001_create_users.sql as idx_users_cognito_sub)
ALTER INDEX IF EXISTS idx_users_cognito_sub RENAME TO idx_users_google_id;
