#!/usr/bin/env bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Adding sqlx:no-transaction directive to all migration files...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$(cd "$INFRA_DIR/../backend" && pwd)"
MIGRATIONS_DIR="$BACKEND_DIR/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}Error: Migrations directory not found at $MIGRATIONS_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found migrations directory: $MIGRATIONS_DIR${NC}"

# Count migrations that need the directive
NEED_UPDATE=0
for migration in "$MIGRATIONS_DIR"/*.sql; do
  if ! grep -q "^-- sqlx:no-transaction" "$migration"; then
    NEED_UPDATE=$((NEED_UPDATE + 1))
  fi
done

echo -e "${YELLOW}Found $NEED_UPDATE migration files that need the directive${NC}"

if [ "$NEED_UPDATE" -eq 0 ]; then
  echo -e "${GREEN}✓ All migration files already have the directive${NC}"
  exit 0
fi

# Add directive to each migration file
UPDATED_COUNT=0
for migration in "$MIGRATIONS_DIR"/*.sql; do
  filename=$(basename "$migration")

  # Check if file already has the directive
  if ! grep -q "^-- sqlx:no-transaction" "$migration"; then
    echo -e "${YELLOW}Updating: $filename${NC}"

    # Create temp file with directive at the top
    {
      echo "-- sqlx:no-transaction"
      cat "$migration"
    } > "$migration.tmp"

    # Replace original file
    mv "$migration.tmp" "$migration"

    UPDATED_COUNT=$((UPDATED_COUNT + 1))
    echo -e "${GREEN}  ✓ Added directive${NC}"
  fi
done

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Directive Addition Complete${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "Files updated: $UPDATED_COUNT"

echo -e "${GREEN}✓ All migration files now have sqlx:no-transaction directive${NC}"
