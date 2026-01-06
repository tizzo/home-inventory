-- Rename cognito_sub to google_id and update constraints
ALTER TABLE users RENAME COLUMN cognito_sub TO google_id;

-- Previous index was named idx_users_cognito_sub (or implicit UNIQUE constraint key)
-- Let's drop the old constraint/index if it exists and ensure the new one is correct

-- Drop the old unique constraint if it was named automatically or explicitly
-- Note: 'users_cognito_sub_key' is the standard naming for UNIQUE constraints in Postgres if not named explicitly
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_cognito_sub_key;

-- Add the new unique constraint
ALTER TABLE users ADD CONSTRAINT users_google_id_key UNIQUE (google_id);

-- Rename index if it exists (explicitly created in schema.sql line 18 as idx_users_cognito_sub)
ALTER INDEX IF EXISTS idx_users_cognito_sub RENAME TO idx_users_google_id;
