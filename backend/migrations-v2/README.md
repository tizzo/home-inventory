# Home Inventory Migrations (v2 - Consolidated)

This directory contains consolidated, DSQL-compatible migrations with **one SQL statement per file**.

## Why Single-Statement Files?

AWS Aurora DSQL requires one DDL statement per transaction. By having one statement per file:
- Works with standard `sqlx migrate run` on both local PostgreSQL and DSQL
- No custom migration runner needed
- Easy to understand what each migration does
- Compatible with any PostgreSQL tooling

## File Naming Convention

```
NNNN_description.sql
```

- `NNNN`: 4-digit sequence number (0001, 0002, etc.)
- `description`: Brief description of what this migration creates

## Logical Groupings

| Range | Content |
|-------|---------|
| 0001-0002 | Tower sessions (schema + table) |
| 0003-0008 | Users and sessions tables |
| 0009-0013 | Labels table |
| 0014-0017 | Rooms table |
| 0018-0022 | Shelving units table |
| 0023-0027 | Shelves table |
| 0028-0033 | Containers table |
| 0034-0042 | Items table |
| 0043-0047 | Tags tables |
| 0048-0051 | Photos table |
| 0052-0056 | Audit logs table |
| 0057-0058 | Product cache table |
| 0059-0063 | Item import drafts table |
| 0064-0066 | Contact submissions table |

## Running Migrations

### Local Development (PostgreSQL)

```bash
# Using sqlx-cli
cd backend
sqlx migrate run --source migrations-v2

# Or using the migration runner script
cd infrastructure/scripts
./apply-migrations.sh --local
```

### Production (AWS Aurora DSQL)

```bash
cd infrastructure/scripts
./apply-migrations.sh --dsql-east   # us-east-1
# Migrations auto-replicate to us-east-2 via multi-region cluster
```

## Key Design Decisions

1. **No Foreign Keys**: All referential integrity is enforced in application code (DSQL limitation)
2. **TEXT instead of JSON/JSONB**: DSQL doesn't support JSON types
3. **CREATE INDEX ASYNC**: Required for DSQL (non-blocking index creation)
4. **-- sqlx:no-transaction**: Each file runs without wrapping in a transaction
5. **No Triggers/Views**: Not supported by DSQL

## Tower Sessions

The tower_sessions schema and table are created in migrations 0001-0002. This means:
- The backend's `session_store.migrate()` call will succeed (no-op since table exists)
- Works correctly on both local PostgreSQL and DSQL
- No special handling needed in application code

## Adding New Migrations

When adding new migrations:
1. Use the next sequence number (e.g., `0067_xxx.sql`)
2. Include `-- sqlx:no-transaction` at the top
3. Use `CREATE INDEX ASYNC` instead of `CREATE INDEX`
4. Avoid foreign key constraints
5. Use `TEXT` instead of `JSON`/`JSONB`
