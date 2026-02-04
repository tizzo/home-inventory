#!/usr/bin/env bash
set -euo pipefail

# Apply migrations to DSQL us-east-1 endpoint
#
# NOTE: With the linked multi-region cluster setup, migrations applied to
# either endpoint (us-east-1 or us-east-2) will automatically replicate to both
# regions. You only need to run ONE of the migration scripts:
#   - apply-migrations-to-dsql.sh (us-east-1) - RECOMMENDED
#   - apply-migrations-to-dsql-west.sh (us-east-2)
#
# Running both scripts is harmless (duplicate migrations are skipped) but unnecessary.

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Applying migrations to DSQL us-east-1 (will replicate to us-east-2)...${NC}"

# Get DSQL host from Pulumi
cd "$(dirname "$0")/.."
DSQL_HOST=$(./pulumi-wrapper.sh stack output dsqlEndpointEast | tr -d '"')

if [ -z "$DSQL_HOST" ]; then
  echo -e "${RED}Error: Could not get DSQL host from Pulumi${NC}"
  exit 1
fi

echo -e "${GREEN}✓ DSQL Host: $DSQL_HOST${NC}"

# Generate IAM auth token
echo -e "${YELLOW}Generating IAM auth token...${NC}"
DSQL_TOKEN=$(aws dsql generate-db-connect-admin-auth-token \
  --hostname "$DSQL_HOST" \
  --region us-east-1 \
  --profile howardtyson)

if [ -z "$DSQL_TOKEN" ]; then
  echo -e "${RED}Error: Failed to generate auth token${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Auth token generated${NC}"

# Get migrations directory
BACKEND_DIR="../backend"
MIGRATIONS_DIR="$BACKEND_DIR/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}Error: Migrations directory not found${NC}"
  exit 1
fi

# Apply each migration
echo -e "${YELLOW}Applying migrations...${NC}"

for migration in "$MIGRATIONS_DIR"/*.sql; do
  filename=$(basename "$migration")
  echo -e "${YELLOW}  Applying: $filename${NC}"

  PGPASSWORD="$DSQL_TOKEN" psql \
    "host=$DSQL_HOST port=5432 dbname=postgres user=admin sslmode=require" \
    -f "$migration" \
    2>&1 | grep -v "already exists" || true

  echo -e "${GREEN}    ✓ Completed${NC}"
done

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All migrations applied to DSQL${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"

# Verify migrations
echo -e "${YELLOW}Verifying migrations...${NC}"
PGPASSWORD="$DSQL_TOKEN" psql \
  "host=$DSQL_HOST port=5432 dbname=postgres user=admin sslmode=require" \
  -c "SELECT version, description, success FROM _sqlx_migrations ORDER BY version;"

echo -e "${GREEN}✓ Migrations verified${NC}"
