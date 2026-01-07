# Windsurf Workflows (Copy into `.windsurf/workflows/*.md`)

These are optional workflows tailored to this repo. Each workflow should be copied into its own `.md` file under `.windsurf/workflows/`.

---

## /quality-gates

Title: Quality gates (backend + frontend)

Steps:

1. Backend checks:
   - Run from `backend/`:
     - `cargo fmt`
     - `cargo clippy -- -D warnings`
     - `cargo build`
     - `cargo test`

2. Frontend checks:
   - `npm run type-check`
   - `npm run build`
   - `npm run lint`
   - `npm test` (if present/used)

3. If the repo uses Prettier, run:
   - `prettier --write .`

---

## /typesync

Title: Regenerate frontend types from backend

Steps:

1. Confirm backend model changes are in `backend/src/models/` and use `#[typeshare]`.

2. In `frontend/`, run:
   - `npm run generate-types`

3. Run frontend checks:
   - `npm run type-check`
   - `npm run build`

---

## /debug-update-handler-borrows

Title: Fix borrow-of-moved-value errors in Rust update handlers

Steps:

1. Identify where `Option` fields from a payload are being consumed.

2. Before any `unwrap_or()` / `.or()` calls, compute a change-set by checking:
   - `payload.field.is_some()`
   - `payload.field.as_ref()`

3. After the DB update succeeds, log changes to the audit service.

4. Run:
   - `cargo clippy -- -D warnings`
   - `cargo test`
