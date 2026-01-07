# Backend (Rust) Instructions

## Structure

- Routes in `backend/src/routes/` should be thin request handlers.
- Business logic belongs in `backend/src/services/`.
- `AppState` (in `app.rs`) contains shared dependencies:
  - `db: PgPool`
  - `s3: Arc<S3Service>`
  - `audit: Arc<AuditService>`
  - `app_base_url: String`

## Type Sharing

- Rust models use `typeshare` to generate TypeScript types.
- If you modify models in `backend/src/models/`, ensure the model is `#[typeshare]` and regenerate frontend types with `npm run generate-types`.

## Dual Runtime

- Backend runs both locally and as AWS Lambda.
- `main.rs` checks `AWS_LAMBDA_FUNCTION_NAME` to determine mode.

## Audit Logging

- All CRUD operations must log via the audit service.
- When computing change sets for updates, inspect `Option` fields with `is_some()` / `as_ref()` BEFORE consuming them with `unwrap_or()`.

## Moves

- Entity relocation should use the dedicated move endpoints/services, not standard CRUD updates.
- Common endpoints:
  - `POST /api/shelves/:id/move`
  - `POST /api/containers/:id/move`
  - `POST /api/items/:id/move`

## Photos

- Photo upload flow uses presigned URLs:
  - request upload URL
  - upload directly to S3/MinIO
  - create a photo record
  - serve with presigned download URLs

## Common Gotchas

- When adding a new route module, update `routes/mod.rs` and merge it into the router in `app.rs`.

## Migrations

- Migrations live in `backend/migrations/` and run on startup via SQLx.
- **NEVER edit an already-applied migration.** SQLx checksums migrations; editing causes `VersionMismatch` errors.
- **Always fix forward:** create a new migration for schema changes, even if correcting a mistake.
- If you encounter a `VersionMismatch` error:
  1. Restore the original migration file via `git checkout <commit> -- <file>`.
  2. Create a new migration with the corrected/additional schema.
  3. If the DB is disposable (local dev), reset it: `docker compose down -v postgres && docker compose up -d postgres`.
- New route modules must be added to `routes/mod.rs` and then merged into the router in `app.rs`.

## Quality Gates

- `cargo fmt`
- `cargo clippy -- -D warnings`
- `cargo build`
- `cargo test`
