# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **serverless home inventory management system** with a Rust backend (Axum + AWS Lambda) and TypeScript React frontend. The system uses a **strict hierarchical model**: Room → Shelving Unit → Shelf → Container → Item.

### Key Architectural Patterns

**Type Sharing**: Backend Rust models use `typeshare` to generate TypeScript types. After modifying backend models:
```bash
cd frontend && npm run generate-types
```

**Dual Runtime**: The backend runs both locally (Tokio) and as AWS Lambda. Main.rs checks `AWS_LAMBDA_FUNCTION_NAME` env var to determine mode.

**Service Layer**: All business logic lives in `backend/src/services/`. Routes in `backend/src/routes/` are thin handlers that delegate to services:
- `audit.rs` - Logs all CRUD operations and moves
- `move.rs` - Handles entity relocation (shelf→unit, container→shelf, item→container)
- `qr_pdf.rs` - Generates Avery 18660 label PDFs
- `s3.rs` - Photo storage (works with MinIO locally, S3 in production)

**State Management**: AppState (in `app.rs`) contains:
- `db: PgPool` - PostgreSQL connection pool
- `s3: Arc<S3Service>` - Photo storage service
- `audit: Arc<AuditService>` - Change tracking service
- `app_base_url: String` - For QR code generation

**Deep Linking**: Every UI state must have a URL. Use React Router for all navigation. Modal states should update the URL when possible.

## Critical Build Process

### Before ANY commit or declaring work complete:

**Backend**:
```bash
cd backend
cargo fmt                              # Format code
cargo clippy -- -D warnings            # Fix ALL warnings
cargo build                            # Must succeed
cargo test                             # All tests pass
```

**Frontend**:
```bash
cd frontend
npm run type-check                     # TypeScript strict checking
npm run build                          # MUST succeed - do not skip
npm run lint                           # Fix all issues
```

### Type Generation Workflow

When you modify Rust models (in `backend/src/models/`):
1. Models must have `#[typeshare]` derive macro
2. Build.rs runs typeshare to generate bindings
3. Run `npm run generate-types` in frontend to copy generated types
4. Frontend types are in `frontend/src/types/generated.ts`

## Common Development Commands

### Local Development Setup

**Start infrastructure** (PostgreSQL + MinIO):
```bash
docker-compose up -d postgres minio minio-init
```

**Backend**:
```bash
cd backend
export DATABASE_URL="postgresql://postgres:devpass@localhost:5432/inventory"
sqlx migrate run                       # Run migrations
cargo run                              # Start server on :3000
```

**Frontend**:
```bash
cd frontend
npm install
npm run generate-types                 # Generate types from Rust
npm run dev                            # Start on :5173
```

### Database Migrations

Migrations in `backend/migrations/` run automatically on startup. To create new migration:
```bash
cd backend
sqlx migrate add <name>
```

Migrations are numbered (e.g., `20240101000000_`) to ensure order. Key migrations:
- `000003_create_hierarchy.sql` - Core Room/Unit/Shelf/Container/Item tables
- `000006_create_audit.sql` - Audit log system
- `000009_create_triggers.sql` - Auto-update timestamps

### Running Tests

**Backend**:
```bash
cargo test                             # Unit tests
cargo test --features integration-tests # With DB (requires DATABASE_URL)
```

**Frontend**:
```bash
npm test
```

## Development Workflow Rules

### Audit Logging Pattern

**All CRUD operations must log to audit service**. Pattern for update handlers:
```rust
// 1. Track changes BEFORE consuming payload (avoid borrow errors)
let mut changes = serde_json::Map::new();
if payload.name.is_some() && payload.name.as_ref() != Some(&existing.name) {
    changes.insert("name".to_string(), serde_json::json!({
        "from": &existing.name,
        "to": payload.name.as_ref().unwrap()
    }));
}

// 2. Then consume payload for database update
let name = payload.name.unwrap_or(existing.name.clone());

// 3. Log after successful update
if !changes.is_empty() {
    state.audit.log_update("entity_type", id, user_id,
        serde_json::Value::Object(changes), None).await.ok();
}
```

**Critical**: Check `is_some()` and use `as_ref()` BEFORE calling `unwrap_or()` or `.or()` which consume the Option.

### Photo Upload Flow

1. Frontend requests presigned URL: `POST /api/photos/upload-url` with `content_type`
2. Backend generates S3 presigned URL (1 hour validity)
3. Frontend uploads directly to S3 using presigned URL
4. Frontend creates photo record: `POST /api/photos` with S3 key
5. Backend serves photos via presigned download URLs (24 hour validity)

Photos are polymorphic - attach to any entity via `entity_type` + `entity_id`.

### Move Operations

Moving entities uses dedicated move service (not standard CRUD updates):
- `POST /api/shelves/:id/move` - Move shelf to different shelving unit
- `POST /api/containers/:id/move` - Move container to different shelf/parent
- `POST /api/items/:id/move` - Move item to different shelf/container

Moves are logged separately in audit trail with `from_location` and `to_location`.

## Git Commit Standards

**Commit autonomously with small, incremental changes.** Make frequent commits that add functionality in slices that are easy to understand and review later. This allows safe autonomous operation.

**Before each commit**:
- Ensure all tests pass (`cargo test`, `npm test`)
- Ensure lints are clean (`cargo clippy`, `npm run lint`)
- Ensure builds succeed (`cargo build`, `npm run build`)

**Commit message format**:
```
type: single line summary (50 chars max)


Explain WHY this change was made (not WHAT changed).
Focus on the problem solved or need addressed.
```

**Good commit messages**:
- `fix: resolve borrow of moved value errors in update handlers` - Explains the problem
- `feat: add audit logs to navigation menu` - Makes feature discoverable
- `refactor: organize and alphabetize route module structure` - Improves maintainability

**Bad commit messages** (avoid these):
- `Added error handling` - What for?
- `Updated Room model` - Why?
- `Fixed bug` - Which bug? What impact?

**Never**:
- Mention AI/Claude/Cursor in commits
- Commit without running build + tests
- Use generic messages like "WIP" or "updates"

## Environment Variables

**Backend** (`.env` or environment):
```bash
DATABASE_URL=postgresql://postgres:devpass@localhost:5432/inventory
APP_BASE_URL=http://localhost:5173    # For QR codes
S3_ENDPOINT=http://localhost:9000     # MinIO locally
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=home-inventory-photos
S3_REGION=us-east-1
RUST_LOG=debug
```

**Frontend**:
```bash
VITE_API_URL=http://localhost:3000
```

## Common Gotchas

1. **Borrow errors in update handlers**: Always check `payload.field.is_some()` BEFORE consuming with `unwrap_or()`
2. **Frontend build failing**: Run `npm run generate-types` after backend model changes
3. **S3 connection errors**: Ensure MinIO is running via `docker-compose up minio`
4. **Migration errors**: Migrations run on startup - check `DATABASE_URL` is correct
5. **CORS issues**: Backend allows all origins in dev mode (configured in `app.rs`)
6. **Route not found**: New route modules must be added to `routes/mod.rs` AND merged in `app.rs`

## Testing Strategy

- Backend tests are in `mod tests` blocks within files
- Use `#[ignore]` for tests requiring DATABASE_URL
- Integration tests require running Postgres
- Frontend uses React Testing Library (when configured)
- QR code generation can be tested with `services/qr_pdf.rs` tests
