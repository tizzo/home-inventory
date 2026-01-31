# AWS Deployment Checklist

Quick reference checklist for deploying the home inventory application to AWS.

## ✅ Prerequisites Completed

Before starting deployment, ensure you have:

- [ ] AWS account created
- [ ] AWS CLI installed and configured with profile `howardtyson`
- [ ] Pulumi CLI installed (`curl -fsSL https://get.pulumi.com | sh`)
- [ ] Node.js 20+ installed (`node --version`)
- [ ] Rust installed with ARM64 target (`rustup target add aarch64-unknown-linux-gnu`)
- [ ] cargo-lambda installed (`pip install cargo-lambda`)
- [ ] Domain registered or transferred to Route 53
- [ ] Google OAuth credentials created (Client ID + Secret)
- [ ] Anthropic API key obtained

## 📋 Deployment Steps

### 1. Setup Pulumi S3 State Backend and KMS (10 minutes)

```bash
# Create S3 bucket for Pulumi state (one-time)
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

# Create KMS key for Pulumi secrets encryption with tags
KEY_ID=$(aws kms create-key \
  --description "Pulumi secrets encryption for home-inventory" \
  --tags '[
    {"TagKey":"project","TagValue":"home-inventory"},
    {"TagKey":"managedBy","TagValue":"pulumi"},
    {"TagKey":"environment","TagValue":"production"},
    {"TagKey":"purpose","TagValue":"pulumi-secrets"}
  ]' \
  --profile howardtyson \
  --query 'KeyMetadata.KeyId' \
  --output text)

# Create KMS alias
aws kms create-alias \
  --alias-name alias/pulumi-home-inventory \
  --target-key-id $KEY_ID \
  --profile howardtyson

# Add tags to S3 bucket
aws s3api put-bucket-tagging \
  --bucket home-inventory-pulumi-state \
  --tagging 'TagSet=[{Key=project,Value=home-inventory},{Key=managedBy,Value=pulumi},{Key=environment,Value=production},{Key=purpose,Value=pulumi-state}]' \
  --profile howardtyson
```

**Verification:**
```bash
aws s3 ls s3://home-inventory-pulumi-state --profile howardtyson
aws kms describe-key --key-id alias/pulumi-home-inventory --profile howardtyson
```

**Note:** This uses S3 for state and KMS for secrets encryption (open source) - NOT Pulumi Cloud.

### 2. Initialize Pulumi Stack (5 minutes)

```bash
cd infrastructure

# Install dependencies
npm install

# Export AWS credentials for Pulumi
export AWS_PROFILE=howardtyson
export AWS_REGION=us-east-1

# Login to S3 backend (NOT Pulumi Cloud)
pulumi login s3://home-inventory-pulumi-state

# Create production stack with KMS secrets encryption
pulumi stack init prod --secrets-provider="awskms://alias/pulumi-home-inventory?region=us-east-1"

# Configure stack
pulumi config set aws:region us-east-1
pulumi config set aws:profile howardtyson
pulumi config set domainName YOUR_DOMAIN.com
pulumi config set githubRepo OWNER/REPO_NAME

# Set secrets
pulumi config set --secret googleClientId "YOUR_CLIENT_ID"
pulumi config set --secret googleClientSecret "YOUR_SECRET"
pulumi config set --secret anthropicApiKey "YOUR_KEY"
```

**Verification:**
```bash
pulumi config
# Should show all config values (secrets will be encrypted)

# Verify stack file was created
ls Pulumi.prod.yaml
# Should exist with your config values
```

**Note:** Your Pulumi state and config are stored in:
- State: `s3://home-inventory-pulumi-state/` (remote, in S3)
- Config: `Pulumi.prod.yaml` (local file)
- Secrets: Encrypted with AWS KMS key `alias/pulumi-home-inventory`

**Important:**
- Commit `Pulumi.prod.yaml` to git (secrets are encrypted with KMS)
- Your AWS IAM user/role needs `kms:Decrypt` and `kms:Encrypt` permissions on the KMS key

### 3. Build Lambda Function (10 minutes)

```bash
cd backend

# Build for ARM64 Lambda
cargo lambda build --release --arm64 --output-format zip

# Verify build
ls -lh target/lambda/home-inventory-backend/bootstrap.zip
# Should show ~4-6MB file

# Copy to infrastructure dist/
cp target/lambda/home-inventory-backend/bootstrap.zip ../infrastructure/dist/
```

**Verification:**
```bash
ls -lh infrastructure/dist/bootstrap.zip
# Should exist and be ~4-6MB
```

### 4. Build Frontend (5 minutes)

```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Build production bundle
npm run build

# Verify build
ls -lh dist/
# Should contain index.html, assets/, etc.
```

**Verification:**
```bash
ls frontend/dist/index.html
# Should exist
```

### 5. Deploy Infrastructure (30 minutes)

```bash
cd infrastructure

# Preview changes (dry run)
pulumi preview

# Review all resources to be created
# Press Enter to continue

# Deploy all resources
pulumi up

# Type "yes" when prompted
# Wait for deployment to complete (20-30 minutes)
```

**What gets deployed:**
- IAM roles (Lambda execution, GitHub Actions OIDC)
- S3 buckets (frontend, photos with replication)
- Aurora DSQL clusters (us-east-1, us-east-2)
- Lambda functions (us-east-1, us-east-2)
- API Gateway HTTP APIs (us-east-1, us-east-2)
- ACM certificate (DNS validation)
- CloudFront distribution
- Route 53 DNS records
- CloudWatch logs and alarms

**Verification:**
```bash
pulumi stack output
# Should show all exported values
```

### 6. Deploy Frontend to S3 (5 minutes)

```bash
# Get bucket name
BUCKET_NAME=$(cd infrastructure && pulumi stack output frontendBucketName)

# Sync frontend to S3
cd frontend
aws s3 sync dist/ s3://$BUCKET_NAME --delete --profile howardtyson

# Get CloudFront distribution ID
DIST_ID=$(cd ../infrastructure && pulumi stack output cloudFrontDistributionId)

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*" \
  --profile howardtyson
```

**Verification:**
```bash
aws s3 ls s3://$BUCKET_NAME/ --profile howardtyson
# Should show index.html, assets/, etc.
```

### 7. Verify Deployment (10 minutes)

**Check DNS propagation:**
```bash
dig YOUR_DOMAIN.com
# Should show CloudFront IP addresses
# May take 5-60 minutes to propagate
```

**Test API endpoint:**
```bash
curl https://YOUR_DOMAIN.com/api/health
# Expected: {"status":"healthy","database":"connected"}
```

**Test frontend:**
```bash
curl -I https://YOUR_DOMAIN.com
# Expected: HTTP/2 200
# Expected headers: x-amz-cf-id (CloudFront), x-cache: Hit from cloudfront
```

**Test authentication:**
```bash
# Open in browser
open https://YOUR_DOMAIN.com

# Should:
# 1. Redirect to Google OAuth login
# 2. After login, show rooms page
# 3. Check browser console for errors (none expected)
```

### 8. Setup GitHub Actions (10 minutes)

**Get required values:**
```bash
cd infrastructure
pulumi stack output githubActionsRoleArn
pulumi stack output frontendBucketName
pulumi stack output cloudFrontDistributionId
```

**Add GitHub secrets:**
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add three secrets:
   - `GITHUB_ACTIONS_ROLE_ARN` = (output from above)
   - `FRONTEND_BUCKET_NAME` = (output from above)
   - `CLOUDFRONT_DISTRIBUTION_ID` = (output from above)

**Note:** No passphrase needed - GitHub Actions will use the IAM role to access KMS for decrypting secrets.

**Test GitHub Actions:**
```bash
# Create test commit
git checkout -b test-deployment
git commit --allow-empty -m "Test deployment"
git push origin test-deployment

# Open PR and verify PR validation workflow runs
# Merge to main and verify production deployment workflow runs
```

**Verification:**
- Go to GitHub repo → Actions
- Should see two successful workflow runs:
  - "PR Validation" (on PR)
  - "Deploy Production" (on merge to main)

### 9. Update Google OAuth (2 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project → APIs & Services → Credentials
3. Select OAuth 2.0 Client ID
4. Update Authorized redirect URIs:
   - Add: `https://YOUR_DOMAIN.com/api/auth/callback`
   - Remove: `http://localhost:3000/api/auth/callback` (if present)
5. Save changes

**Verification:**
```bash
# Test login again
open https://YOUR_DOMAIN.com
# Should redirect to Google OAuth and back successfully
```

### 10. Enable Monitoring (5 minutes)

**CloudWatch Dashboard:**
1. Go to AWS Console → CloudWatch → Dashboards
2. Open `home-inventory-prod`
3. Pin to favorites

**Setup SNS for Alarms (optional):**
```bash
# Create SNS topic
aws sns create-topic --name home-inventory-alerts --profile howardtyson

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:home-inventory-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --profile howardtyson

# Check email and confirm subscription
```

**Setup AWS Budget (recommended):**
1. Go to AWS Console → Billing → Budgets
2. Create budget:
   - Budget name: home-inventory-prod
   - Period: Monthly
   - Budget type: Cost budget
   - Budgeted amount: $100
3. Add email alert at 80% threshold

## ✅ Post-Deployment Verification

### Functional Testing

- [ ] API health check passes (`curl https://YOUR_DOMAIN.com/api/health`)
- [ ] Frontend loads without errors
- [ ] Google OAuth login works
- [ ] Create a room (test database write)
- [ ] Upload a photo (test S3 upload)
- [ ] Generate QR code (test label generation)
- [ ] Scan QR code (test camera access)
- [ ] Check CloudWatch logs for errors

### Performance Testing

- [ ] Lambda cold start <3 seconds (check CloudWatch)
- [ ] Lambda warm invocation <100ms (check CloudWatch)
- [ ] Frontend loads <2 seconds (check browser DevTools)
- [ ] API response time <500ms (check CloudWatch)

### Multi-Region Testing

```bash
# Disable us-east-1 Lambda (simulate failure)
aws lambda put-function-concurrency \
  --function-name backend-east-1 \
  --reserved-concurrent-executions 0 \
  --region us-east-1 \
  --profile howardtyson

# Verify requests still work (CloudFront routes to us-east-2)
curl https://YOUR_DOMAIN.com/api/health
# Should still return 200 OK

# Re-enable us-east-1
aws lambda delete-function-concurrency \
  --function-name backend-east-1 \
  --region us-east-1 \
  --profile howardtyson
```

### Cost Verification

```bash
# Check AWS Cost Explorer
# Go to AWS Console → Billing → Cost Explorer
# Filter by: Service, Last 7 days
# Expected services: Lambda, API Gateway, CloudFront, S3, DSQL, Route 53
# Expected total: ~$1-2 for first week (DSQL prorated)
```

## 🎉 Deployment Complete!

**Your application is now live at:** `https://YOUR_DOMAIN.com`

**Next Steps:**
1. Monitor CloudWatch dashboard for first 24 hours
2. Check AWS Cost Explorer daily for first week
3. Test all features thoroughly
4. Document any issues in GitHub
5. Share with users!

## 📊 Expected Costs

| Usage Level | Monthly Cost |
|-------------|--------------|
| 0 requests (idle) | ~$30.50 (DSQL + S3 + Route 53) |
| 10K requests | ~$31-51 |
| 100K requests | ~$35-55 |
| 1M requests | ~$70-90 |

**Free Tier Coverage:**
- Lambda: Free for first 1M requests/month
- CloudFront: Free for first 10M requests/month
- S3: Free for first 5GB storage

## 🚨 Troubleshooting

If something goes wrong during deployment, see:
- **Infrastructure README**: `infrastructure/README.md`
- **Deployment Guide**: `docs/DEPLOYMENT.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`

Common issues:
- **Certificate validation stuck**: Wait 10 minutes, DNS propagation can be slow
- **Lambda "bootstrap not found"**: Verify ZIP file copied to `infrastructure/dist/`
- **DSQL connection timeout**: Check IAM permissions, verify connection string format
- **CloudFront 403**: Wait for distribution to deploy (can take 20 minutes)

## 🔄 Rollback Procedure

If deployment fails:

```bash
cd infrastructure

# View deployment history
pulumi stack history

# Rollback to previous version
pulumi stack export --version VERSION_NUMBER | pulumi stack import

# Reconcile state
pulumi up
```

## 📝 Maintenance

**Weekly:**
- Check CloudWatch dashboard for errors
- Review AWS Cost Explorer

**Monthly:**
- Review and optimize Lambda memory allocation
- Review S3 storage usage
- Rotate secrets if needed

**Quarterly:**
- Update dependencies (`npm update`, `cargo update`)
- Review and update IAM permissions
- Audit CloudWatch logs retention

---

**Support:** For issues, see `docs/DEPLOYMENT.md` or open GitHub issue.
