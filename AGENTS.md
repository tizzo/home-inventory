# Project Instructions

## Architecture Overview

- This repository is a serverless home inventory management system.
- Backend: Rust (Axum) running locally (Tokio) and on AWS Lambda.
- Frontend: TypeScript + React.
- Domain model is a strict hierarchy:
  - Room -> Shelving Unit -> Shelf -> Container -> Item

## Cross-cutting Conventions

- Prefer test-driven development (red-green-refactor) when practical.
- Ask for clarification rather than making assumptions.
- Keep changes small and incremental.

## Type Sharing

- Backend Rust models use `typeshare` to generate TypeScript types.
- After modifying backend models, run type generation in the frontend:
  - `npm run generate-types`

## Deep Linking

- Every discrete UI state must have a deep-linkable URL.
- Use React Router for navigation.
- Modal states, filters, and tabs should be reflected in the URL when possible.

## Quality Gates (before declaring work complete)

### Backend

- `cargo fmt`
- `cargo clippy -- -D warnings`
- `cargo build`
- `cargo test`

### Frontend

- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm test` (if present/used)
- `prettier --write .` (if configured for the repo)

## Git Commit Standards

- Commit in small, understandable slices.
- Use conventional commits: `type: summary`.
- Commit messages must explain WHY, not WHAT.
- Do not mention AI/Cascade/Windsurf in commit messages.

## Commit Message Format

```
type: single line summary (50 chars max)


Explain WHY this change was made (not WHAT changed).
```
