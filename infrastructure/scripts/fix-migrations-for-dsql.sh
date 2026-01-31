#!/usr/bin/env bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Fixing migration files for Aurora DSQL compatibility...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$(cd "$INFRA_DIR/../backend" && pwd)"
MIGRATIONS_DIR="$BACKEND_DIR/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}Error: Migrations directory not found at $MIGRATIONS_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found migrations directory: $MIGRATIONS_DIR${NC}"

# Count CREATE INDEX statements before
BEFORE_COUNT=$(grep -r "CREATE INDEX " "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v "ASYNC" | wc -l | tr -d ' ')
echo -e "${YELLOW}Found $BEFORE_COUNT CREATE INDEX statements to convert${NC}"

if [ "$BEFORE_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✓ No CREATE INDEX statements need conversion (all already ASYNC)${NC}"
  exit 0
fi

# Create backup
BACKUP_DIR="$BACKEND_DIR/migrations-backup-$(date +%Y%m%d-%H%M%S)"
echo -e "${YELLOW}Creating backup at: $BACKUP_DIR${NC}"
cp -r "$MIGRATIONS_DIR" "$BACKUP_DIR"
echo -e "${GREEN}✓ Backup created${NC}"

# Fix each migration file
FIXED_COUNT=0
for migration in "$MIGRATIONS_DIR"/*.sql; do
  filename=$(basename "$migration")

  # Check if file has CREATE INDEX without ASYNC
  if grep -q "CREATE INDEX " "$migration" && ! grep -q "CREATE INDEX ASYNC" "$migration"; then
    echo -e "${YELLOW}Fixing: $filename${NC}"

    # Replace CREATE INDEX with CREATE INDEX ASYNC
    # Use | as delimiter to avoid conflicts with /
    sed -i.bak 's|CREATE INDEX |CREATE INDEX ASYNC |g' "$migration"

    # Remove backup file created by sed
    rm -f "$migration.bak"

    FIXED_COUNT=$((FIXED_COUNT + 1))
    echo -e "${GREEN}  ✓ Converted CREATE INDEX → CREATE INDEX ASYNC${NC}"
  fi
done

# Count after
AFTER_COUNT=$(grep -r "CREATE INDEX " "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v "ASYNC" | wc -l | tr -d ' ')

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Migration Conversion Complete${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "Files modified: $FIXED_COUNT"
echo -e "Statements before: $BEFORE_COUNT"
echo -e "Statements after: $AFTER_COUNT"
echo -e "Backup location: $BACKUP_DIR"

if [ "$AFTER_COUNT" -ne 0 ]; then
  echo -e "${RED}⚠ Warning: $AFTER_COUNT CREATE INDEX statements still exist without ASYNC${NC}"
  echo -e "${RED}   Manual review may be needed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ All CREATE INDEX statements successfully converted to ASYNC${NC}"
