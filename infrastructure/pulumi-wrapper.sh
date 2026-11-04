#! /usr/bin/env bash
set -euo pipefail

# Admin credentials from an `aws login` session (see infrastructure/README.md).
# They are exported as plain env vars rather than via AWS_PROFILE, because the
# aws-native provider would otherwise record the profile name in stack state
# and CI (which has no such profile) would then diff against it.
profile="${PULUMI_AWS_PROFILE:-howardtyson-root-temp}"
eval "$(aws configure export-credentials --profile "$profile" --format env)" || {
  echo "Error: no credentials for profile $profile; run: aws login --profile $profile"
  exit 1
}
unset AWS_PROFILE
export AWS_REGION="${AWS_REGION:-us-east-1}"

# The state backend is set in Pulumi.yaml (the shared howardtyson-pulumi-state bucket)

# Change to infrastructure directory (where Pulumi.yaml lives)
cd "$(dirname "$0")" || {
  echo "Error: Failed to change to infrastructure directory"
  exit 1
}

# Run pulumi command with all arguments passed through
pulumi "$@"
