#!/usr/bin/env bash
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Applying DSQL-compatible migrations manually...${NC}"

# DSQL endpoint from Pulumi output
DSQL_HOST="${1:-wvtqfedshlrqrpu3htizgdtvoa.dsql.us-east-1.on.aws}"

echo -e "${GREEN}✓ DSQL Host: $DSQL_HOST${NC}"
echo -e "${YELLOW}This script will convert CREATE INDEX to CREATE INDEX ASYNC and apply migrations${NC}"
echo ""

# Get the backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$(cd "$INFRA_DIR/../backend" && pwd)"

if [ ! -d "$BACKEND_DIR/migrations" ]; then
  echo -e "${RED}Error: Migrations directory not found at $BACKEND_DIR/migrations${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found migrations directory: $BACKEND_DIR/migrations${NC}"

# Create a temporary directory for modified migrations
TEMP_DIR=$(mktemp -d)
echo -e "${GREEN}✓ Created temp directory: $TEMP_DIR${NC}"

# Copy and modify migrations
for migration in "$BACKEND_DIR/migrations"/*.sql; do
  filename=$(basename "$migration")
  echo -e "${YELLOW}Processing: $filename${NC}"

  # Replace CREATE INDEX with CREATE INDEX ASYNC
  sed 's/CREATE INDEX /CREATE INDEX ASYNC /g' "$migration" > "$TEMP_DIR/$filename"

  echo -e "${GREEN}  ✓ Converted CREATE INDEX to CREATE INDEX ASYNC${NC}"
done

echo ""
echo -e "${YELLOW}Modified migrations are in: $TEMP_DIR${NC}"
echo -e "${YELLOW}To apply these migrations, you need to:${NC}"
echo ""
echo "1. Get IAM credentials for DSQL"
echo "2. Run each migration file against DSQL"
echo "3. The indexes will be created asynchronously"
echo ""
echo -e "${RED}NOTE: This script requires manual execution of migrations via psql with IAM auth${NC}"
echo -e "${RED}      See: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-iam-authentication.html${NC}"
