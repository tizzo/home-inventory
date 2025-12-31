-- Enable UUID and pg_trgm extensions (PostgreSQL only)
-- DSQL doesn't support extensions - this migration will be skipped on DSQL
-- Application will use uuid::Uuid::new_v4() for UUID generation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

