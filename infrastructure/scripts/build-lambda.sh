#!/usr/bin/env bash
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building Lambda function for AWS deployment...${NC}"

# Get the infrastructure directory (where this script lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Find the backend directory (in worktree)
BACKEND_DIR="$(cd "$INFRA_DIR/../backend" && pwd)"

if [ ! -d "$BACKEND_DIR" ]; then
  echo -e "${RED}Error: Backend directory not found at $BACKEND_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found backend directory: $BACKEND_DIR${NC}"

# Check if cargo-lambda is installed
if ! command -v cargo-lambda &> /dev/null; then
  echo -e "${RED}Error: cargo-lambda is not installed${NC}"
  echo "Install it with: pip install cargo-lambda"
  echo "Or with Homebrew: brew install cargo-lambda"
  exit 1
fi

echo -e "${GREEN}✓ cargo-lambda is installed${NC}"

# Navigate to backend and build
echo -e "${YELLOW}Building Lambda function (this may take a few minutes)...${NC}"
cd "$BACKEND_DIR"

cargo lambda build --release --arm64 --output-format zip

# Check if build succeeded
LAMBDA_ZIP="$BACKEND_DIR/target/lambda/home-inventory-backend/bootstrap.zip"
if [ ! -f "$LAMBDA_ZIP" ]; then
  echo -e "${RED}Error: Lambda ZIP not found at $LAMBDA_ZIP${NC}"
  exit 1
fi

# Show ZIP file size
ZIP_SIZE=$(du -h "$LAMBDA_ZIP" | cut -f1)
echo -e "${GREEN}✓ Lambda ZIP built successfully: $ZIP_SIZE${NC}"

# Create dist directory in infrastructure
DIST_DIR="$INFRA_DIR/dist"
mkdir -p "$DIST_DIR"

# Copy ZIP to infrastructure dist
cp "$LAMBDA_ZIP" "$DIST_DIR/bootstrap.zip"

echo -e "${GREEN}✓ Lambda ZIP copied to: $DIST_DIR/bootstrap.zip${NC}"
echo -e "${GREEN}✓ Build complete! You can now run: ./pulumi-wrapper.sh preview${NC}"
