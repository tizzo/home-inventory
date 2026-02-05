#!/usr/bin/env bash
set -euo pipefail

# Universal Migration Runner for Home Inventory
# Works with both local PostgreSQL and AWS Aurora DSQL
#
# Features:
# - Executes SQL statements one-by-one (DSQL compatible)
# - Tracks applied migrations in _sqlx_migrations table
# - Supports both local development and production DSQL
#
# Usage:
#   ./apply-migrations.sh                    # Auto-detect from environment
#   ./apply-migrations.sh --local            # Force local PostgreSQL
#   ./apply-migrations.sh --dsql-east        # DSQL us-east-1
#   ./apply-migrations.sh --dsql-west        # DSQL us-east-2
#   ./apply-migrations.sh --connection-string "postgresql://..." # Custom

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$(cd "$INFRA_DIR/../backend" && pwd)"

# Default to migrations (consolidated, DSQL-compatible single-statement files)
MIGRATIONS_DIR="$BACKEND_DIR/migrations"

# Parse arguments
MODE="auto"
CONNECTION_STRING=""
DSQL_HOST=""
DSQL_REGION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --local)
      MODE="local"
      shift
      ;;
    --dsql-east)
      MODE="dsql"
      DSQL_REGION="us-east-1"
      shift
      ;;
    --dsql-west)
      MODE="dsql"
      DSQL_REGION="us-east-2"
      shift
      ;;
    --connection-string)
      MODE="custom"
      CONNECTION_STRING="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Determine connection based on mode
setup_connection() {
  case $MODE in
    local)
      echo -e "${BLUE}Using local PostgreSQL${NC}"
      CONNECTION_STRING="${DATABASE_URL:-postgresql://postgres:devpass@localhost:5432/inventory}"
      export PGPASSWORD="${DATABASE_PASSWORD:-devpass}"
      ;;
    dsql)
      echo -e "${BLUE}Using DSQL in $DSQL_REGION${NC}"
      cd "$INFRA_DIR"

      if [ "$DSQL_REGION" = "us-east-1" ]; then
        DSQL_HOST=$(./pulumi-wrapper.sh stack output dsqlEndpointEast 2>/dev/null | tr -d '"')
      else
        DSQL_HOST=$(./pulumi-wrapper.sh stack output dsqlEndpointWest 2>/dev/null | tr -d '"')
      fi

      if [ -z "$DSQL_HOST" ]; then
        echo -e "${RED}Error: Could not get DSQL endpoint from Pulumi${NC}"
        exit 1
      fi

      echo -e "${GREEN}✓ DSQL Host: $DSQL_HOST${NC}"

      # Generate IAM auth token
      DSQL_TOKEN=$(aws dsql generate-db-connect-admin-auth-token \
        --hostname "$DSQL_HOST" \
        --region "$DSQL_REGION" \
        --profile "${AWS_PROFILE:-howardtyson}" 2>/dev/null)

      if [ -z "$DSQL_TOKEN" ]; then
        echo -e "${RED}Error: Failed to generate DSQL auth token${NC}"
        exit 1
      fi

      CONNECTION_STRING="host=$DSQL_HOST port=5432 dbname=postgres user=admin sslmode=require"
      export PGPASSWORD="$DSQL_TOKEN"
      ;;
    custom)
      echo -e "${BLUE}Using custom connection${NC}"
      ;;
    auto)
      # Check if DATABASE_URL is set
      if [ -n "${DATABASE_URL:-}" ]; then
        CONNECTION_STRING="$DATABASE_URL"
        echo -e "${BLUE}Using DATABASE_URL from environment${NC}"
      else
        echo -e "${YELLOW}No DATABASE_URL set, defaulting to local PostgreSQL${NC}"
        CONNECTION_STRING="postgresql://postgres:devpass@localhost:5432/inventory"
        export PGPASSWORD="devpass"
      fi
      ;;
  esac
}

# Create migrations tracking table if it doesn't exist
ensure_migrations_table() {
  echo -e "${YELLOW}Ensuring migrations table exists...${NC}"

  psql "$CONNECTION_STRING" -q -c "
    CREATE TABLE IF NOT EXISTS _sqlx_migrations (
      version BIGINT PRIMARY KEY,
      description TEXT NOT NULL,
      installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      success BOOLEAN NOT NULL DEFAULT TRUE,
      checksum BYTEA NOT NULL,
      execution_time BIGINT NOT NULL DEFAULT 0
    );
  " 2>/dev/null || true

  echo -e "${GREEN}✓ Migrations table ready${NC}"
}

# Check if a migration has been applied
is_migration_applied() {
  local version=$1
  local result
  result=$(psql "$CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM _sqlx_migrations WHERE version = $version;" 2>/dev/null | tr -d ' ')
  [ "$result" -gt 0 ]
}

# Mark migration as applied
mark_migration_applied() {
  local version=$1
  local description=$2
  local checksum=$3

  psql "$CONNECTION_STRING" -q -c "
    INSERT INTO _sqlx_migrations (version, description, checksum, success)
    VALUES ($version, '$description', E'\\\\x$checksum', TRUE)
    ON CONFLICT (version) DO NOTHING;
  " 2>/dev/null
}

# Execute SQL statements one by one
execute_migration_file() {
  local file=$1
  local filename=$(basename "$file")
  local version=$(echo "$filename" | grep -oE '^[0-9]+')
  local description=$(echo "$filename" | sed 's/^[0-9]*_//' | sed 's/\.sql$//')

  # Check if already applied
  if is_migration_applied "$version"; then
    echo -e "  ${BLUE}⏭ Already applied: $filename${NC}"
    return 0
  fi

  echo -e "  ${YELLOW}▶ Applying: $filename${NC}"

  # Calculate checksum
  local checksum=$(sha256sum "$file" | cut -c1-64)

  # Read file and split into statements
  local content
  content=$(cat "$file")

  # Remove comments that start with -- at beginning of line
  content=$(echo "$content" | sed '/^--/d')

  # Split by semicolon and execute each statement
  local IFS=';'
  local statement_num=0
  local success=true

  for statement in $content; do
    # Trim whitespace
    statement=$(echo "$statement" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

    # Skip empty statements
    if [ -z "$statement" ] || [ "$statement" = $'\n' ]; then
      continue
    fi

    statement_num=$((statement_num + 1))

    # Execute statement
    if ! psql "$CONNECTION_STRING" -q -c "$statement" 2>&1 | grep -v "already exists" | grep -v "NOTICE"; then
      # Statement executed (grep returns 1 if no match, which is fine)
      true
    fi

    # Check for actual errors (not "already exists")
    local exit_code=${PIPESTATUS[0]}
    if [ $exit_code -ne 0 ]; then
      # Check if it's just an "already exists" error
      local error_output
      error_output=$(psql "$CONNECTION_STRING" -c "$statement" 2>&1 || true)
      if echo "$error_output" | grep -q "already exists"; then
        echo -e "    ${BLUE}(object already exists, skipping)${NC}"
      else
        echo -e "    ${RED}✗ Statement $statement_num failed${NC}"
        echo -e "    ${RED}$error_output${NC}"
        success=false
        break
      fi
    fi
  done

  if [ "$success" = true ]; then
    mark_migration_applied "$version" "$description" "$checksum"
    echo -e "    ${GREEN}✓ Applied successfully${NC}"
  else
    echo -e "    ${RED}✗ Migration failed${NC}"
    return 1
  fi
}

# Main execution
main() {
  echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║   Home Inventory Migration Runner      ║${NC}"
  echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
  echo ""

  # Verify migrations directory exists
  if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}Error: Migrations directory not found: $MIGRATIONS_DIR${NC}"
    exit 1
  fi

  setup_connection
  echo ""

  ensure_migrations_table
  echo ""

  echo -e "${YELLOW}Applying migrations...${NC}"

  local applied=0
  local skipped=0
  local failed=0

  for migration in "$MIGRATIONS_DIR"/*.sql; do
    if [ ! -f "$migration" ]; then
      continue
    fi

    if execute_migration_file "$migration"; then
      if is_migration_applied "$(basename "$migration" | grep -oE '^[0-9]+')"; then
        # Already applied before this run
        if [ -z "${NEWLY_APPLIED:-}" ]; then
          skipped=$((skipped + 1))
        else
          applied=$((applied + 1))
        fi
      else
        applied=$((applied + 1))
      fi
    else
      failed=$((failed + 1))
    fi
  done

  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   Migration Summary                    ║${NC}"
  echo -e "${GREEN}╠════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║   Applied: $applied                              ${NC}"
  echo -e "${GREEN}║   Skipped: $skipped                              ${NC}"
  if [ $failed -gt 0 ]; then
    echo -e "${RED}║   Failed:  $failed                              ${NC}"
  fi
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"

  if [ $failed -gt 0 ]; then
    exit 1
  fi
}

main "$@"
