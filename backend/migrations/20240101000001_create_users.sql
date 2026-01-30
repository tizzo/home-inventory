-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    cognito_sub VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC idx_users_email ON users(email);
CREATE INDEX ASYNC idx_users_cognito_sub ON users(cognito_sub);

-- Sessions table (for cookie-based auth)
-- Note: No foreign key constraint for DSQL compatibility
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL, -- References users(id) - enforced in application
    csrf_token VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ASYNC idx_sessions_user_id ON sessions(user_id);
CREATE INDEX ASYNC idx_sessions_expires_at ON sessions(expires_at);

