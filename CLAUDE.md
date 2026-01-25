# Claude Code Assistant Guide

This document helps Claude Code quickly find relevant documentation and understand the codebase structure.

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
📖 **Read First**: [CURRENT_STATUS.md](./CURRENT_STATUS.md)
- What's implemented
- What's in progress
- What's next

### Adding New Features
📖 **Read First**:
- [AGENTS.md](./AGENTS.md) - Project-wide rules and conventions
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development workflows
- [TODO.md](./TODO.md) - Planned features and priorities

### Backend Work
📖 **Read First**: [backend/AGENTS.md](./backend/AGENTS.md)
- Backend-specific conventions
- Database migration rules
- Quality gates (clippy, tests, etc.)

### Frontend Work
📖 **Read First**: [frontend/AGENTS.md](./frontend/AGENTS.md)
- Frontend-specific conventions
- Component patterns
- Type generation from backend

### Infrastructure Setup
- **Google OAuth**: [backend/GOOGLE_AUTH_SETUP.md](./backend/GOOGLE_AUTH_SETUP.md)
- **MinIO Storage**: [MINIO_SETUP.md](./MINIO_SETUP.md)
- **Frontend Config**: [FRONTEND_SETUP.md](./FRONTEND_SETUP.md)

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

## Important Rules

### Database Migrations
⚠️ **NEVER edit existing migrations!** Always create new ones.
- SQLx checksums migrations; editing causes `VersionMismatch` errors
- See [AGENTS.md](./AGENTS.md) for full details

### Type Sharing
- Backend models use `typeshare` to generate TypeScript types
- After modifying backend models: `cd frontend && npm run generate-types`

### Deep Linking
- Every discrete UI state must have a deep-linkable URL
- Use React Router for navigation
- Modal states, filters, tabs should be in URL when possible

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
