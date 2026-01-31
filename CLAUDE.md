# Claude Code Assistant Guide

This document helps Claude Code quickly find relevant documentation and understand the codebase structure.

---

## ⚠️ CRITICAL: Quality Gates - Run Before EVERY Commit

**NO EXCEPTIONS** - These must pass before any `git commit`. Run after EVERY code change, no matter how small.

### Backend (run from backend/ directory):
```bash
cargo fmt                    # Format code
cargo clippy -- -D warnings  # Lint with zero warnings
cargo build                  # Verify compilation
cargo test                   # Run tests (if any exist)
```

### Frontend (run from frontend/ directory):
```bash
npm run type-check          # TypeScript type checking
npm run build              # Verify build succeeds
npm run lint               # ESLint (fix new issues only)
```

### Workflow:
1. **Small change** (1-5 files max)
2. **Run quality gates** immediately
3. **Fix any issues** that appear
4. **Commit** with descriptive message *never* attributed to claude or ai
5. **Repeat** - Never accumulate uncommitted changes

**Why this matters**: Catching issues immediately is 10x faster than debugging later. Small, verified commits make code review and rollback trivial.

---

## 🎯 Project at a Glance

**Home Inventory System** - Full-stack inventory management with AI-powered photo analysis.

**Status**: 🟢 **95%+ feature complete** - Production ready for basic use

**Scale**:
- ~50 API endpoints
- 10 main pages, 15+ reusable components
- 12 database tables
- ~15,000 lines of code (backend + frontend)
- Test coverage: Minimal (needs work)

**Key Features**:
- ✅ Complete CRUD for all entity types
- ✅ Google OAuth authentication
- ✅ Photo upload/storage (MinIO/S3)
- ✅ QR code labels and scanning
- ✅ AI-powered item recognition (Claude Vision)
- ✅ Audit logging with user tracking
- ✅ Move operations between locations
- ⏳ Tag management (backend ready, UI needed)
- ⏳ Search/filtering (basic only)

## 🏥 Quick Health Check

Before starting work, verify the system is running:

```bash
# Check infrastructure
docker compose ps                    # PostgreSQL + MinIO should be "Up"

# Check backend
curl http://localhost:3000/health   # Should return 200 OK

# Check frontend
curl -I http://localhost:5173       # Should return 200

# Check database connection
psql postgresql://postgres:devpass@localhost:5432/inventory -c "SELECT 1"

# Check MinIO
curl http://localhost:9000/minio/health/live  # Should return "OK"
```

## Documentation Index

**Start here**: [DOCUMENTATION.md](./DOCUMENTATION.md) - Complete index of all documentation files.

## Common Tasks - Where to Look

### Working on Authentication/Login
📖 **Read First**: [docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md)
- Complete authentication architecture
- Where all auth code lives
- Common issues and fixes
- OAuth flow diagram

### Setting Up the Project
📖 **Read First**: [QUICK_START.md](./QUICK_START.md)
- Fast-track local setup
- Required dependencies
- Environment variables

### Understanding Current State
📖 **Read First**: [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)
- What's implemented (95%+ feature complete!)
- What's in progress
- What's next

### Adding New Features
📖 **Read First**:
- [AGENTS.md](./AGENTS.md) - Project-wide rules and conventions
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Development workflows
- [TODO.md](./TODO.md) - Planned features and priorities
- [docs/REFACTORING.md](./docs/REFACTORING.md) - Component refactoring opportunities

### Backend Work
📖 **Read First**: [backend/AGENTS.md](./backend/AGENTS.md)
- Backend-specific conventions
- Database migration rules (**CRITICAL**: Never edit existing migrations!)
- Quality gates (clippy, tests, etc.)

### Frontend Work
📖 **Read First**: [frontend/AGENTS.md](./frontend/AGENTS.md)
- Frontend-specific conventions
- Component patterns
- Type generation: `npm run generate-types`

### Infrastructure Setup
- **Quick Start**: [QUICK_START.md](./QUICK_START.md) - Get running in minutes
- **Google OAuth**: [backend/GOOGLE_AUTH_SETUP.md](./backend/GOOGLE_AUTH_SETUP.md)
- **MinIO Storage**: [docs/MINIO_SETUP.md](./docs/MINIO_SETUP.md)
- **Frontend**: [docs/FRONTEND_SETUP.md](./docs/FRONTEND_SETUP.md) (historical reference)

## Architecture Quick Reference

### Tech Stack
- **Backend**: Rust (Axum framework)
- **Frontend**: TypeScript + React + Vite
- **Database**: PostgreSQL
- **Storage**: MinIO (S3-compatible)
- **Auth**: Google OAuth 2.0 with PostgreSQL sessions

### Domain Model Hierarchy
```
Room
  └─ Shelving Unit
      └─ Shelf
          └─ Container
              └─ Item
```

### Key Directories
```
backend/
  ├─ src/
  │   ├─ routes/       # API endpoints
  │   ├─ middleware/   # Auth, CORS, etc.
  │   └─ models/       # Database models (with typeshare)
  └─ migrations/       # SQL migrations (never edit existing!)

frontend/
  ├─ src/
  │   ├─ components/   # React components
  │   ├─ hooks/        # Custom React hooks
  │   ├─ api/          # API client
  │   └─ types/        # TypeScript types (generated + manual)

docs/                  # Architecture documentation
```

## Critical Rules (Read Before Making Changes!)

### 🚨 Database Migrations
**NEVER edit existing migrations!** Always create new ones.
- SQLx checksums migrations; editing causes `VersionMismatch` errors
- Fix forward: create new migration, don't modify old ones
- See [AGENTS.md](./AGENTS.md) for full details

### 🔄 Type Sharing
Backend Rust → Frontend TypeScript types via `typeshare`:
```bash
cd frontend && npm run generate-types
```
Run this after modifying any backend models!

### 🔗 Deep Linking
Every UI state must have a deep-linkable URL:
- Pages, modals, filters, search results - all in URL
- Users must be able to bookmark and share any state

### 🏗️ Infrastructure / Pulumi
**ALWAYS use the pulumi wrapper script** - never call `pulumi` directly:
```bash
# ✅ Correct
./pulumi-wrapper.sh preview
./pulumi-wrapper.sh up
./pulumi-wrapper.sh stack output frontendBucketName

# ❌ Wrong
pulumi preview
pulumi up
pulumi stack output frontendBucketName
```
- The wrapper script handles AWS credentials and S3 backend configuration
- Direct `pulumi` calls will fail with region/credential errors
- Located at: `infrastructure/pulumi-wrapper.sh`

### ☁️ AWS Aurora DSQL & Migrations
**CRITICAL**: Aurora DSQL has strict transaction limitations that affect migrations.

**Key Limitations:**
- ❌ No support for multiple DDL statements in transactions
- ❌ PostgreSQL creates implicit transactions when multiple statements are sent together
- ❌ SQLx's `migrate!()` macro wraps migrations in transactions (incompatible with DSQL)
- ❌ `-- sqlx:no-transaction` directive doesn't prevent implicit PostgreSQL transactions

**Migration Strategy for DSQL:**
1. **Use manual psql scripts** instead of embedded SQLx migrations
2. Scripts apply migrations statement-by-statement (no implicit transactions)
3. Located at: `infrastructure/scripts/apply-migrations-to-dsql*.sh`
4. Must be run separately for each DSQL cluster (us-east-1, us-east-2)

**Migration File Requirements:**
- Add `-- sqlx:no-transaction` to the top of all migration files
- Use `CREATE INDEX ASYNC` instead of `CREATE INDEX` (DSQL requirement)
- Use `TEXT` instead of `JSON` or `JSONB` (DSQL doesn't support JSON types)
- Avoid `ALTER TABLE ADD COLUMN ... DEFAULT` (use nullable columns)
- Avoid `ALTER TABLE DROP/ADD CONSTRAINT` (manage constraints at table creation)

**Tower Sessions Exception:**
- tower-sessions library's `migrate()` also fails on DSQL
- Manually create `tower_sessions` schema and table via psql
- See: `backend/migrations/20240101000013_create_tower_sessions.sql`

**Multi-Region DSQL:**
- Current setup: **Two independent clusters** (us-east-1, us-east-2)
- Migrations must be applied to both clusters separately
- Each cluster maintains its own data (no replication)
- To create true multi-region replication: Must destroy and recreate as linked cluster set with witness region

**References:**
- [SQLx Issue #3693: Multiple statements per migration](https://github.com/launchbadge/sqlx/issues/3693)
- [tower-sessions PostgresStore migration](https://github.com/maxcountryman/tower-sessions-stores/blob/main/sqlx-store/src/postgres_store.rs)
- [AWS DSQL Multi-Region Docs](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/configuring-multi-region-clusters.html)

## ⚠️ Known Issues & Gotchas

### Common Problems

**Port Conflicts**
- PostgreSQL: 5432
- MinIO API: 9000
- MinIO Console: 9001
- Backend: 3000
- Frontend: 5173

If ports are in use: `lsof -ti:PORT | xargs kill -9`

**MinIO Bucket**
- Bucket auto-creates on backend startup
- If you see "bucket not found", restart backend
- Check backend logs for "Successfully created S3 bucket" message

**Session/Auth Issues**
- Session cookies require `withCredentials: true` in API client
- Check `frontend/src/api/client.ts:5` and `frontend/src/hooks/useAuth.ts`
- Sessions stored in PostgreSQL (not in-memory)
- CORS issues if `APP_BASE_URL` doesn't match frontend URL

**Type Mismatches**
- Frontend types can get stale after backend changes
- Always run `npm run generate-types` after modifying Rust models
- TypeScript errors often mean types need regeneration

**Database Migrations**
- If migration fails: Check backend logs for specific error
- Never edit existing migration files (will cause VersionMismatch)
- To reset local DB: `docker compose down -v postgres && docker compose up -d postgres`

## 🚫 What NOT to Do (Anti-patterns)

**Code Changes**:
- ❌ Don't edit existing migrations - always create new ones
- ❌ Don't break the domain hierarchy (Room → Unit → Shelf → Container → Item)
- ❌ Don't skip `withCredentials: true` on API calls
- ❌ Don't use `axios` directly - use the configured `apiClient`
- ❌ Don't create markdown docs without adding to DOCUMENTATION.md

**Git Workflow**:
- ❌ Don't use `git add .` or `git add -A` - stage specific files by name
- ❌ Don't commit without running quality gates (fmt, clippy, lint, build)
- ❌ Don't push to main without PR (if team workflow is established)

**Development**:
- ❌ Don't skip type generation after backend changes
- ❌ Don't hard-code API URLs - use environment variables
- ❌ Don't add features without checking TODO.md first
- ❌ Don't refactor without tests (when they exist)

## Quality Gates Checklist

### Before committing backend changes:
```bash
cargo fmt
cargo clippy -- -D warnings
cargo build
cargo test
```

### Before committing frontend changes:
```bash
npm run type-check
npm run build
npm run lint
npm test  # if tests exist
```

## Environment Variables

### Backend (.env)
```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/home_inventory
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URL=http://localhost:3000/api/auth/callback
APP_BASE_URL=http://localhost:5173
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

### Frontend
Uses Vite proxy to backend (see `frontend/vite.config.ts`)

## Common Patterns

### Adding a New API Endpoint

1. Create route handler in `backend/src/routes/`
2. Add route to router in relevant module or `app.rs`
3. Run quality gates
4. Create frontend API function in `frontend/src/api/`
5. Use in component with React Query

### Adding Protected Route

1. Wrap route with `<ProtectedRoute>` in `App.tsx`
2. Use `useAuth()` hook to access user info
3. Backend endpoints use `UserSession` extractor for auth

## Getting Help

- Check [DOCUMENTATION.md](./DOCUMENTATION.md) for all available docs
- Search codebase for similar patterns
- Review [AGENTS.md](./AGENTS.md) for architectural decisions
- Check [TODO.md](./TODO.md) for planned work that might relate

## Quick Command Reference

```bash
# Start backend
cd backend && cargo run

# Start frontend
cd frontend && npm run dev

# Start PostgreSQL + MinIO
docker compose up -d

# Run all quality checks
cd backend && cargo fmt && cargo clippy && cargo test
cd frontend && npm run type-check && npm run build && npm run lint

# Generate TypeScript types from Rust
cd frontend && npm run generate-types
```

---

**Remember**: When in doubt, check [DOCUMENTATION.md](./DOCUMENTATION.md) for the complete documentation index!
