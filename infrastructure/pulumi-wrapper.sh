#! /usr/bin/env bash
set -euo pipefail

# Set AWS credentials
export AWS_PROFILE="${AWS_PROFILE:-howardtyson}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

# Set Pulumi S3 backend (eliminates need for 'pulumi login')
export PULUMI_BACKEND_URL="${PULUMI_BACKEND_URL:-s3://home-inventory-pulumi-state}"

# Change to infrastructure directory (where Pulumi.yaml lives)
cd "$(dirname "$0")" || {
  echo "Error: Failed to change to infrastructure directory"
  exit 1
}

# Run pulumi command with all arguments passed through
pulumi "$@"
