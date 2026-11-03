#! /usr/bin/env bash
set -euo pipefail

# Set AWS credentials
export AWS_PROFILE="${AWS_PROFILE:-howardtyson}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

# The state backend is set in Pulumi.yaml (the shared howardtyson-pulumi-state bucket)

# Change to infrastructure directory (where Pulumi.yaml lives)
cd "$(dirname "$0")" || {
  echo "Error: Failed to change to infrastructure directory"
  exit 1
}

# Run pulumi command with all arguments passed through
pulumi "$@"
