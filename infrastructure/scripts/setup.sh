#!/bin/bash
set -e

# Home Inventory Infrastructure Setup Script
# This script automates the initial setup process

export AWS_REGION="us-east-1"

echo "🚀 Home Inventory Infrastructure Setup"
echo "========================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Install with: pip install awscli"
    exit 1
fi

if ! command -v pulumi &> /dev/null; then
    echo "❌ Pulumi CLI not found. Install with: curl -fsSL https://get.pulumi.com | sh"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install with: nvm install 20"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust not found. Install with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo "✅ All prerequisites installed"
echo ""

# Get AWS profile
read -p "Enter AWS CLI profile name [default: howardtyson]: " AWS_PROFILE
AWS_PROFILE=${AWS_PROFILE:-howardtyson}

# Get domain name
read -p "Enter your domain name (e.g., example.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    echo "❌ Domain name is required"
    exit 1
fi

# Get GitHub repo
read -p "Enter GitHub repo (format: owner/repo-name): " GITHUB_REPO
if [ -z "$GITHUB_REPO" ]; then
    echo "❌ GitHub repo is required"
    exit 1
fi

echo ""
echo "Creating S3 bucket for Pulumi state..."

PULUMI_BUCKET="home-inventory-pulumi-state"

# Check if bucket exists
if aws s3 ls "s3://$PULUMI_BUCKET" --profile "$AWS_PROFILE" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "Creating bucket $PULUMI_BUCKET..."
    aws s3 mb "s3://$PULUMI_BUCKET" --region us-east-1 --profile "$AWS_PROFILE"

    echo "Enabling versioning..."
    aws s3api put-bucket-versioning \
        --bucket "$PULUMI_BUCKET" \
        --versioning-configuration Status=Enabled \
        --profile "$AWS_PROFILE"

    echo "Enabling encryption..."
    aws s3api put-bucket-encryption \
        --bucket "$PULUMI_BUCKET" \
        --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}' \
        --profile "$AWS_PROFILE"

    echo "Adding tags..."
    aws s3api put-bucket-tagging \
        --bucket "$PULUMI_BUCKET" \
        --tagging 'TagSet=[{Key=project,Value=home-inventory},{Key=managedBy,Value=pulumi},{Key=environment,Value=production},{Key=purpose,Value=pulumi-state}]' \
        --profile "$AWS_PROFILE"

    echo "✅ S3 bucket created"
else
    echo "✅ S3 bucket already exists"
fi

echo ""
echo "Installing Pulumi dependencies..."
cd "$(dirname "$0")/.."
npm install

echo ""
echo "Logging into Pulumi S3 backend (NOT Pulumi Cloud)..."
# Export AWS_PROFILE so Pulumi can use it
export AWS_PROFILE="$AWS_PROFILE"
pulumi login "s3://$PULUMI_BUCKET"
echo "✅ Using S3 backend for Pulumi state"

echo ""
echo "Creating KMS key for Pulumi secrets encryption..."
KMS_ALIAS="alias/pulumi-home-inventory"

# Check if KMS key exists
if aws kms describe-key --key-id "$KMS_ALIAS" --profile "$AWS_PROFILE" 2>/dev/null; then
    echo "✅ KMS key already exists"
else
    echo "Creating KMS key..."
    KEY_ID=$(aws kms create-key \
        --description "Pulumi secrets encryption for home-inventory" \
        --tags '[
            {"TagKey":"project","TagValue":"home-inventory"},
            {"TagKey":"managedBy","TagValue":"pulumi"},
            {"TagKey":"environment","TagValue":"production"},
            {"TagKey":"purpose","TagValue":"pulumi-secrets"}
        ]' \
        --profile "$AWS_PROFILE" \
        --query 'KeyMetadata.KeyId' \
        --output text)

    echo "Creating KMS alias..."
    aws kms create-alias \
        --alias-name "$KMS_ALIAS" \
        --target-key-id "$KEY_ID" \
        --profile "$AWS_PROFILE"

    echo "✅ KMS key created with tags"
fi

echo ""
echo "Checking for existing stack..."
if pulumi stack select prod 2>/dev/null; then
    echo "✅ Stack 'prod' already exists"
else
    echo "Creating stack 'prod' with KMS secrets encryption..."
    pulumi stack init prod --secrets-provider="awskms://$KMS_ALIAS?region=us-east-1"
fi

echo ""
echo "Configuring stack..."
pulumi config set aws:region us-east-1
pulumi config set aws:profile "$AWS_PROFILE"
pulumi config set domainName "$DOMAIN_NAME"
pulumi config set githubRepo "$GITHUB_REPO"

echo ""
echo "⚠️  Please enter secrets manually (will be encrypted with KMS):"
echo ""
echo "  pulumi config set --secret googleClientId 'YOUR_CLIENT_ID'"
echo "  pulumi config set --secret googleClientSecret 'YOUR_CLIENT_SECRET'"
echo "  pulumi config set --secret anthropicApiKey 'YOUR_ANTHROPIC_KEY'"
echo ""
echo "Note: Secrets are encrypted with AWS KMS key: $KMS_ALIAS"
echo "Your AWS IAM user needs kms:Encrypt and kms:Decrypt permissions."
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Set secrets (see commands above)"
echo "  2. Build Lambda: cd ../backend && cargo lambda build --release --arm64 --output-format zip"
echo "  3. Copy Lambda ZIP: cp ../backend/target/lambda/home-inventory-backend/bootstrap.zip dist/"
echo "  4. Deploy: pulumi up"
