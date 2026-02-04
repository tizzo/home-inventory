#!/usr/bin/env bash
set -euo pipefail

# Script to connect to Aurora DSQL using psql with IAM authentication
# Usage: ./connect-dsql.sh [region]
#   region: east (us-east-1) or west (us-east-2), defaults to east

REGION="${1:-east}"
DB_NAME="postgres"
DB_USER="admin"

# Validate region parameter
if [[ "$REGION" != "east" && "$REGION" != "west" ]]; then
  echo "Error: Region must be 'east' or 'west'"
  echo "Usage: $0 [east|west]"
  exit 1
fi

# Determine AWS region
if [[ "$REGION" == "east" ]]; then
  AWS_REGION="us-east-1"
  OUTPUT_KEY="dsqlEndpointEast"
else
  AWS_REGION="us-east-2"
  OUTPUT_KEY="dsqlEndpointWest"
fi

echo "Connecting to DSQL cluster in $AWS_REGION..."

# Get DSQL endpoint from Pulumi stack outputs
cd "$(dirname "$0")/.."
DSQL_ENDPOINT=$(../pulumi-wrapper.sh stack output "$OUTPUT_KEY" --stack prod)

if [[ -z "$DSQL_ENDPOINT" ]]; then
  echo "Error: Could not retrieve DSQL endpoint from Pulumi stack"
  exit 1
fi

echo "DSQL Endpoint: $DSQL_ENDPOINT"

# Generate IAM authentication token
echo "Generating IAM auth token..."
export PGPASSWORD=$(aws dsql generate-db-connect-admin-auth-token \
  --hostname "$DSQL_ENDPOINT" \
  --region "$AWS_REGION" \
  --expires-in 3600)

if [[ -z "$PGPASSWORD" ]]; then
  echo "Error: Failed to generate IAM auth token"
  exit 1
fi

echo "Connecting to database..."
echo "  Host: $DSQL_ENDPOINT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Region: $AWS_REGION"
echo ""

# Connect with psql
psql "host=$DSQL_ENDPOINT dbname=$DB_NAME user=$DB_USER sslmode=require"
