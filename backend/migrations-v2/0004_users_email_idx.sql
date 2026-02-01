-- sqlx:no-transaction
CREATE INDEX ASYNC idx_users_email ON users(email);
