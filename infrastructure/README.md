# Home Inventory Infrastructure

This directory contains the Pulumi Infrastructure as Code (IaC) for deploying the home inventory application to AWS.

## Architecture

**Multi-region active-active deployment:**
- Primary region: `us-east-1`
- Secondary region: `us-east-2`
- CloudFront for global CDN and API routing
- Aurora DSQL for multi-region database with strong consistency
- Lambda functions (ARM64) for serverless compute
- S3 for frontend hosting and photo storage

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Domain in Route 53** (or ability to add DNS records)
3. **Pulumi CLI** installed (`curl -fsSL https://get.pulumi.com | sh`)
4. **Node.js 20+** and npm
5. **AWS CLI** configured with profile

## Project Structure

```
infrastructure/
├── index.ts              # Main Pulumi program
├── src/
│   ├── types.ts          # TypeScript type definitions
│   ├── iam.ts            # IAM roles and OIDC provider
│   ├── database.ts       # Aurora DSQL multi-region
│   ├── storage.ts        # S3 buckets (frontend + photos)
│   ├── lambda.ts         # Lambda functions + API Gateway
│   ├── cloudfront.ts     # CloudFront + Route 53 + ACM
│   └── monitoring.ts     # CloudWatch logs and alarms
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript configuration
└── Pulumi.yaml           # Pulumi project definition
```

## Initial Setup

### Step 1: Create S3 Bucket and KMS Key for Pulumi

```bash
# Create S3 bucket for Pulumi state (one-time setup)
aws s3 mb s3://home-inventory-pulumi-state --region us-east-1 --profile howardtyson

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket home-inventory-pulumi-state \
  --versioning-configuration Status=Enabled \
  --profile howardtyson

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket home-inventory-pulumi-state \
  --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}' \
  --profile howardtyson

# Create KMS key for Pulumi secrets encryption
KEY_ID=$(aws kms create-key \
  --description "Pulumi secrets encryption for home-inventory" \
  --profile howardtyson \
  --query 'KeyMetadata.KeyId' \
  --output text)

# Create KMS alias
aws kms create-alias \
  --alias-name alias/pulumi-home-inventory \
  --target-key-id $KEY_ID \
  --profile howardtyson
```

**Note:** This S3 bucket stores Pulumi state files, and KMS encrypts secrets. This is the open-source approach and does NOT use Pulumi Cloud.

### Step 2: Install Dependencies

```bash
cd infrastructure
npm install
```

### Step 3: Login to Pulumi with S3 Backend

```bash
# Export AWS credentials for Pulumi
export AWS_PROFILE=howardtyson
export AWS_REGION=us-east-1

# Login to S3 backend (NOT Pulumi Cloud)
pulumi login s3://home-inventory-pulumi-state
```

**Important:** Pulumi needs AWS credentials to access the S3 bucket. Make sure to export `AWS_PROFILE` and `AWS_REGION` before running `pulumi login`.

### Step 4: Create Pulumi Stack with KMS Encryption

```bash
# Create stack with KMS secrets encryption
pulumi stack init prod --secrets-provider="awskms://alias/pulumi-home-inventory?region=us-east-1"
```

**Note:** This configures Pulumi to use AWS KMS for encrypting secrets instead of a passphrase.

### Step 5: Configure Stack

```bash
# AWS settings
pulumi config set aws:region us-east-1
pulumi config set aws:profile howardtyson

# Domain and GitHub repo
pulumi config set domainName your-domain.com
pulumi config set githubRepo owner/home-inventory

# Secrets (encrypted in Pulumi.prod.yaml with AWS KMS)
pulumi config set --secret googleClientId "YOUR_GOOGLE_CLIENT_ID"
pulumi config set --secret googleClientSecret "YOUR_GOOGLE_CLIENT_SECRET"
pulumi config set --secret anthropicApiKey "YOUR_ANTHROPIC_API_KEY"
```

**Important:** Your Pulumi state and secrets are stored in:
- State: `s3://home-inventory-pulumi-state/` (versioned, encrypted)
- Config: `Pulumi.prod.yaml` (local file, commit to git)
- Secrets: Encrypted with AWS KMS key `alias/pulumi-home-inventory`

**IAM Permissions Required:**
Your AWS IAM user/role needs these KMS permissions:
```json
{
  "Effect": "Allow",
  "Action": ["kms:Decrypt", "kms:Encrypt", "kms:DescribeKey"],
  "Resource": "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_ID"
}
```

### Step 6: Build Lambda ZIP

```bash
# Install cargo-lambda
pip install cargo-lambda

# Build Lambda function
cd ../backend
cargo lambda build --release --arm64 --output-format zip

# Copy to infrastructure directory
mkdir -p ../infrastructure/dist
cp target/lambda/home-inventory-backend/bootstrap.zip ../infrastructure/dist/
```

### Step 7: Deploy Infrastructure

```bash
cd ../infrastructure

# Preview changes
pulumi preview

# Deploy
pulumi up
```

## Deployment

### Manual Deployment

```bash
# Deploy infrastructure changes
pulumi up

# Deploy frontend to S3
aws s3 sync ../frontend/dist/ s3://$(pulumi stack output frontendBucketName) --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $(pulumi stack output cloudFrontDistributionId) \
  --paths "/*"
```

### GitHub Actions Deployment

The deployment is automated via GitHub Actions:

1. **PR Validation** (`.github/workflows/pr-validation.yml`):
   - Runs on pull requests
   - No AWS access required
   - Validates code quality (format, lint, tests)

2. **Production Deployment** (`.github/workflows/deploy-prod.yml`):
   - Runs on push to `main` branch
   - Uses OIDC for AWS authentication (no long-lived credentials)
   - Builds Lambda + frontend, deploys via Pulumi

**Required GitHub Secrets:**
- `GITHUB_ACTIONS_ROLE_ARN`: IAM role ARN (output from Pulumi)
- `FRONTEND_BUCKET_NAME`: S3 bucket name (output from Pulumi)
- `CLOUDFRONT_DISTRIBUTION_ID`: CloudFront distribution ID (output from Pulumi)

Get these values:
```bash
pulumi stack output githubActionsRoleArn
pulumi stack output frontendBucketName
pulumi stack output cloudFrontDistributionId
```

## Stack Outputs

View all stack outputs:
```bash
pulumi stack output
```

Important outputs:
- `websiteUrl`: Main website URL (https://your-domain.com)
- `githubActionsRoleArn`: IAM role for GitHub Actions OIDC
- `apiEndpointEast`: API Gateway endpoint (us-east-1)
- `apiEndpointWest`: API Gateway endpoint (us-east-2)
- `dsqlEndpointEast`: DSQL cluster endpoint (us-east-1)
- `dsqlEndpointWest`: DSQL cluster endpoint (us-east-2)
- `lambdaFunctionNameEast`: Lambda function name (us-east-1)
- `lambdaFunctionNameWest`: Lambda function name (us-east-2)

## Cost Estimates

Monthly cost for typical usage (~10K requests/month):

| Service | Cost |
|---------|------|
| Lambda | $0 (free tier) |
| API Gateway HTTP API | $0.01 |
| CloudFront | $0 (free tier) |
| S3 Storage (10 GB) | $0.23 |
| Aurora DSQL | $30-50 |
| Route 53 | $0.50 |
| **Total** | **~$31-51/month** |

True scale-to-zero: Lambda costs $0 when idle.

## Monitoring

### CloudWatch Dashboard

View metrics at: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=home-inventory-prod

### Lambda Logs

```bash
# Tail logs for us-east-1
aws logs tail /aws/lambda/$(pulumi stack output lambdaFunctionNameEast) --follow

# Tail logs for us-east-2
aws logs tail /aws/lambda/$(pulumi stack output lambdaFunctionNameWest) --follow --region us-east-2
```

### CloudWatch Alarms

Alarms configured for:
- Lambda error rate (>10 errors in 10 minutes)
- Lambda duration (approaching 30s timeout)

## Troubleshooting

### Error: "NoCredentialProviders" when running `pulumi login`

**Error:**
```
error: problem logging in: read ".pulumi/meta.yaml": blob (key ".pulumi/meta.yaml") (code=Unknown): NoCredentialProviders: no valid providers in chain.
```

**Cause:** AWS credentials are not configured or not exported to the environment.

**Solution:**
```bash
# Export AWS credentials before running pulumi commands
export AWS_PROFILE=howardtyson
export AWS_REGION=us-east-1

# Then run pulumi login
pulumi login s3://home-inventory-pulumi-state
```

**Alternative:** Add to your `~/.bashrc` or `~/.zshrc`:
```bash
export AWS_PROFILE=howardtyson
export AWS_REGION=us-east-1
```

### Lambda "bootstrap: no such file or directory"

Ensure `handler` is set to `"bootstrap"` in `lambda.ts` and the ZIP contains a `bootstrap` binary.

### DSQL connection timeout

- Verify `sslmode=require` in connection string
- Check IAM permissions for Lambda role
- Verify DSQL cluster status in AWS console

### CloudFront 403 from S3

- Verify OAI permissions in S3 bucket policy
- Check that bucket is not public
- Ensure CloudFront distribution is enabled

### Certificate validation stuck

DNS validation can take 5-10 minutes. Check Route 53 for validation CNAME records.

## Updating Resources

### Update Lambda Function

```bash
# Rebuild Lambda
cd backend
cargo lambda build --release --arm64 --output-format zip

# Copy to dist/
cp target/lambda/home-inventory-backend/bootstrap.zip ../infrastructure/dist/

# Deploy
cd ../infrastructure
pulumi up
```

### Update Frontend

```bash
# Rebuild frontend
cd frontend
npm run build

# Sync to S3
aws s3 sync dist/ s3://$(cd ../infrastructure && pulumi stack output frontendBucketName) --delete

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id $(cd ../infrastructure && pulumi stack output cloudFrontDistributionId) \
  --paths "/*"
```

### Update Infrastructure Code

```bash
cd infrastructure

# Make changes to TypeScript files
# ...

# Type check
npm run type-check

# Preview changes
pulumi preview

# Deploy
pulumi up
```

## Rollback

### Rollback Pulumi Stack

```bash
# View stack history
pulumi stack history

# Rollback to previous state
pulumi stack export --version <version> | pulumi stack import
pulumi up  # Reconcile with previous state
```

### Rollback Lambda Only

```bash
# Re-run previous successful GitHub Actions workflow
# Or manually update Lambda function code via AWS console
```

## Destroying Infrastructure

**Warning:** This will delete all resources including data in DSQL and S3.

```bash
cd infrastructure

# Preview what will be deleted
pulumi destroy --preview

# Destroy all resources
pulumi destroy
```

## Security Best Practices

1. **Narrow IAM permissions** after initial deployment
2. **Enable DSQL deletion protection** in production
3. **Enable S3 versioning** for data recovery
4. **Use GitHub Environments** for manual approval gates
5. **Rotate secrets regularly** (Google OAuth, Anthropic API key)

## Development Workflow

1. Create feature branch from `main`
2. Make changes, commit locally
3. Push branch, open PR
4. PR validation runs automatically
5. Merge to `main` after approval
6. Production deployment runs automatically
7. Verify deployment at `https://your-domain.com`

## Support

For issues with:
- **Pulumi**: https://github.com/pulumi/pulumi/issues
- **AWS Services**: AWS Support Console
- **Application**: See main project README

## References

- [Pulumi AWS Documentation](https://www.pulumi.com/registry/packages/aws/)
- [Aurora DSQL Documentation](https://docs.aws.amazon.com/aurora/latest/userguide/aurora-dsql.html)
- [cargo-lambda Documentation](https://www.cargo-lambda.info/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
