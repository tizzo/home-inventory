# Frontend (React/TypeScript) Instructions

## Type Safety

- Use strict typing.
- Do not introduce `any`.

## Deep Linking

- Every discrete UI state must have a URL.
- Use React Router for navigation.
- Modal state should update the URL when possible.

## Generated Types

- Types are generated from Rust models.
- If backend models change, run `npm run generate-types`.
- Generated types live in `frontend/src/types/generated.ts`.

## Quality Gates

- `npm run type-check`
- `npm run build` (always run before declaring frontend work complete)
- `npm run lint`
- `npm test` (if present/used)
- `prettier --write .` (if configured for the repo)
