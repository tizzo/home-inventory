#!/usr/bin/env bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Building and deploying frontend...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$(cd "$INFRA_DIR/../frontend" && pwd)"

# Step 1: Build frontend
echo -e "${YELLOW}Step 1: Building frontend...${NC}"
cd "$FRONTEND_DIR"
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}Error: Build failed, dist directory not found${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Step 2: Get S3 bucket and CloudFront distribution from Pulumi
echo -e "${YELLOW}Step 2: Getting deployment targets from Pulumi...${NC}"
cd "$INFRA_DIR"

BUCKET_NAME=$(./pulumi-wrapper.sh stack output frontendBucketName | tr -d '"')
DIST_ID=$(./pulumi-wrapper.sh stack output cloudFrontDistributionId | tr -d '"')

if [ -z "$BUCKET_NAME" ]; then
  echo -e "${RED}Error: Could not get S3 bucket name from Pulumi${NC}"
  exit 1
fi

if [ -z "$DIST_ID" ]; then
  echo -e "${RED}Error: Could not get CloudFront distribution ID from Pulumi${NC}"
  exit 1
fi

echo -e "${GREEN}✓ S3 Bucket: $BUCKET_NAME${NC}"
echo -e "${GREEN}✓ CloudFront Distribution: $DIST_ID${NC}"

# Step 3: Upload to S3
echo -e "${YELLOW}Step 3: Uploading to S3...${NC}"
aws s3 sync "$FRONTEND_DIR/dist/" "s3://$BUCKET_NAME" \
  --delete \
  --profile howardtyson \
  --no-progress

echo -e "${GREEN}✓ Files uploaded to S3${NC}"

# Step 4: Invalidate CloudFront cache
echo -e "${YELLOW}Step 4: Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --profile howardtyson \
  --output text \
  --query 'Invalidation.Id')

echo -e "${GREEN}✓ Cache invalidation created: $INVALIDATION_ID${NC}"

# Step 5: Verify deployment
echo -e "${YELLOW}Step 5: Verifying deployment...${NC}"
echo ""
echo "S3 files:"
aws s3 ls "s3://$BUCKET_NAME/" --profile howardtyson | grep -E "\.html|\.txt"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Frontend Deployment Complete${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "Website: ${GREEN}https://inventory.howardandcara.com${NC}"
echo -e "CloudFront invalidation: ${YELLOW}$INVALIDATION_ID${NC} (may take 5-10 minutes to propagate)"
echo ""
echo "To check invalidation status:"
echo "  aws cloudfront get-invalidation --distribution-id $DIST_ID --id $INVALIDATION_ID --profile howardtyson"
