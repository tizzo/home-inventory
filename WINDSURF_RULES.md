# Windsurf Rules (Copy into `.windsurf/rules/*.md`)

Below are rules derived from `CLAUDE.md` and `.cursorrules`.

## Project Principles

- Ask for clarification rather than making assumptions.
- Keep changes small and incremental.
- Prefer test-driven development (red-green-refactor) when practical.

## Architecture

- Domain model is a strict hierarchy:
  - Room -> Shelving Unit -> Shelf -> Container -> Item
- Backend is Rust (Axum) that runs locally (Tokio) and on AWS Lambda.
- Frontend is TypeScript + React.

## Type Sharing

- Rust models use `typeshare` to generate TypeScript types.
- After modifying backend models, run `npm run generate-types` in `frontend/`.

## Deep Linking

- Every discrete UI state must have a deep-linkable URL.
- Use React Router for navigation.
- Modal states, filters, and tabs should be reflected in the URL when possible.

## Backend Quality Gates

- Run:
  - `cargo fmt`
  - `cargo clippy -- -D warnings`
  - `cargo build`
  - `cargo test`

## Frontend Quality Gates

- Run:
  - `npm run type-check`
  - `npm run build`
  - `npm run lint`
  - `npm test` (if present/used)
  - `prettier --write .` (if configured)

## Git Commit Standards

- Commit in small, understandable slices.
- Use conventional commits: `type: summary`.
- Commit messages must explain WHY, not WHAT.
- Do not mention AI assistance in commit messages.

### Commit Message Format

```
type: single line summary (50 chars max)


Explain WHY this change was made (not WHAT changed).
```
