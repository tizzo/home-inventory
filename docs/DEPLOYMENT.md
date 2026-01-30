# AWS Deployment Guide

Complete guide to deploying the home inventory application to AWS using Pulumi.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Initial Setup](#initial-setup)
5. [Deployment Process](#deployment-process)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance](#maintenance)

## Overview

This application is deployed to AWS using a **multi-region active-active architecture** with:

- **Compute**: AWS Lambda (ARM64, pure ZIP deployment)
- **Database**: Aurora DSQL (multi-region strong consistency)
- **CDN**: CloudFront (global edge network)
- **Storage**: S3 (frontend + photos with cross-region replication)
- **DNS**: Route 53 (domain management)
- **CI/CD**: GitHub Actions with OIDC (no long-lived credentials)

**Cost**: ~$30-50/month for typical usage, $0 Lambda costs when idle.

## Prerequisites

### AWS Account

1. Create AWS account at https://aws.amazon.com
2. Create IAM user with admin access (or use root for initial setup)
3. Configure AWS CLI:
   ```bash
   aws configure --profile howardtyson
   # Enter: Access Key ID, Secret Access Key, us-east-1, json
   ```

### Domain Name

1. **Option A**: Transfer existing domain to Route 53
2. **Option B**: Use existing domain and add Route 53 as nameservers
3. **Option C**: Register new domain in Route 53

Verify domain is in Route 53:
```bash
aws route53 list-hosted-zones --profile howardtyson
```

### Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URI: `https://your-domain.com/api/auth/callback`
6. Save Client ID and Client Secret

### Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Generate API key
3. Save for later use

### Local Tools

Install required tools:

```bash
# Pulumi CLI
curl -fsSL https://get.pulumi.com | sh

# Node.js 20+ (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Rust (for local testing)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add aarch64-unknown-linux-gnu

# cargo-lambda
pip install cargo-lambda

# AWS CLI (if not installed)
pip install awscli
```

## Architecture

### Request Flow

```
User Request
  ↓
CloudFront Distribution (https://your-domain.com)
  ├─ Static Assets (/*) → S3 (frontend)
  └─ API Requests (/api/*) → Origin Group
      ├─ Primary: API Gateway us-east-1 → Lambda us-east-1 → DSQL us-east-1
      └─ Failover: API Gateway us-east-2 → Lambda us-east-2 → DSQL us-east-2
```

### Components

| Component | Purpose | Region | Cost When Idle |
|-----------|---------|--------|----------------|
| Lambda | Backend API | us-east-1, us-east-2 | $0 |
| API Gateway HTTP API | HTTP routing | us-east-1, us-east-2 | $0 |
| Aurora DSQL | PostgreSQL database | Multi-region | ~$30-50/month |
| S3 | Frontend + photos | us-east-1, us-east-2 | ~$0.23/GB |
| CloudFront | CDN | Global | $0 (free tier) |
| Route 53 | DNS | Global | $0.50/zone |

## Initial Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/home-inventory.git
cd home-inventory
```

### Step 2: Setup Pulumi S3 Backend

```bash
# Create S3 bucket for Pulumi state
aws s3 mb s3://home-inventory-pulumi-state --region us-east-1 --profile howardtyson

# Enable versioning (recommended)
aws s3api put-bucket-versioning \
  --bucket home-inventory-pulumi-state \
  --versioning-configuration Status=Enabled \
  --profile howardtyson

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket home-inventory-pulumi-state \
  --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}' \
  --profile howardtyson
```

### Step 3: Initialize Pulumi Stack

```bash
cd infrastructure

# Install dependencies
npm install

# Login to S3 backend (open source, no Pulumi Cloud)
pulumi login s3://home-inventory-pulumi-state

# Create production stack
pulumi stack init prod
```

### Step 4: Configure Pulumi Stack

```bash
# AWS configuration
pulumi config set aws:region us-east-1
pulumi config set aws:profile howardtyson

# Domain and GitHub repo
pulumi config set domainName your-domain.com  # Replace with your domain
pulumi config set githubRepo owner/repo-name   # Replace with your GitHub repo

# Secrets (encrypted at rest)
pulumi config set --secret googleClientId "YOUR_CLIENT_ID"
pulumi config set --secret googleClientSecret "YOUR_CLIENT_SECRET"
pulumi config set --secret anthropicApiKey "YOUR_ANTHROPIC_KEY"
```

Verify configuration:
```bash
pulumi config
```

### Step 5: Build Lambda Function

```bash
cd ../backend

# Build for ARM64 Lambda
cargo lambda build --release --arm64 --output-format zip

# Verify build
ls -lh target/lambda/home-inventory-backend/bootstrap.zip
# Should show ~4-6MB ZIP file

# Copy to infrastructure dist/
mkdir -p ../infrastructure/dist
cp target/lambda/home-inventory-backend/bootstrap.zip ../infrastructure/dist/
```

### Step 6: Build Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Verify build
ls -lh dist/
```

## Deployment Process

### Deploy Infrastructure with Pulumi

```bash
cd infrastructure

# Preview changes (dry run)
pulumi preview

# Deploy all resources
pulumi up
```

**What happens:**
1. Creates IAM roles (Lambda execution, GitHub Actions OIDC)
2. Creates S3 buckets (frontend, photos with replication)
3. Creates Aurora DSQL clusters (us-east-1, us-east-2)
4. Creates Lambda functions + API Gateway (both regions)
5. Creates ACM certificate + CloudFront distribution
6. Creates Route 53 DNS records
7. Creates CloudWatch logs and alarms

**Expected duration:** 20-30 minutes (mostly CloudFront + certificate validation)

### Monitor Deployment Progress

```bash
# Watch Pulumi output for progress
# Certificate validation: ~5-10 minutes
# CloudFront distribution: ~15-20 minutes
```

### Deploy Frontend to S3

```bash
# Get bucket name from Pulumi output
pulumi stack output frontendBucketName

# Sync frontend to S3
cd ../frontend
aws s3 sync dist/ s3://YOUR-DOMAIN-frontend --delete --profile howardtyson

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $(cd ../infrastructure && pulumi stack output cloudFrontDistributionId) \
  --paths "/*" \
  --profile howardtyson
```

## Post-Deployment

### Verify Deployment

1. **Check DNS propagation** (may take 5-60 minutes):
   ```bash
   dig your-domain.com
   # Should show CloudFront IP addresses
   ```

2. **Test API endpoint**:
   ```bash
   curl https://your-domain.com/api/health
   # Expected: {"status":"healthy","database":"connected"}
   ```

3. **Test frontend**:
   ```bash
   curl -I https://your-domain.com
   # Expected: HTTP/2 200
   ```

4. **Test authentication**:
   - Open https://your-domain.com in browser
   - Should redirect to Google OAuth login
   - After login, should show rooms page

### Setup GitHub Actions

1. **Get Pulumi outputs**:
   ```bash
   cd infrastructure
   pulumi stack output githubActionsRoleArn
   pulumi stack output frontendBucketName
   pulumi stack output cloudFrontDistributionId
   ```

2. **Add GitHub Secrets**:
   - Go to GitHub repo → Settings → Secrets → Actions
   - Add three secrets:
     - `GITHUB_ACTIONS_ROLE_ARN`: Output from step 1
     - `FRONTEND_BUCKET_NAME`: Output from step 1
     - `CLOUDFRONT_DISTRIBUTION_ID`: Output from step 1

3. **Test GitHub Actions**:
   ```bash
   # Create test branch
   git checkout -b test-deployment
   git commit --allow-empty -m "Test deployment"
   git push origin test-deployment

   # Open PR and verify PR validation runs
   # Merge to main and verify production deployment runs
   ```

### Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select OAuth 2.0 Client ID
3. Update authorized redirect URIs:
   - Add: `https://your-domain.com/api/auth/callback`
   - Remove: `http://localhost:3000/api/auth/callback` (if present)
4. Save changes

### Enable Monitoring

1. **CloudWatch Dashboard**:
   - Go to AWS Console → CloudWatch → Dashboards
   - Open `home-inventory-prod`
   - Pin to favorites

2. **Setup SNS for Alarms** (optional):
   ```bash
   # Create SNS topic for alerts
   aws sns create-topic --name home-inventory-alerts --profile howardtyson

   # Subscribe your email
   aws sns subscribe \
     --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:home-inventory-alerts \
     --protocol email \
     --notification-endpoint your-email@example.com \
     --profile howardtyson

   # Update alarms to send to SNS topic (update monitoring.ts)
   ```

3. **Enable AWS Budgets**:
   - Go to AWS Console → Billing → Budgets
   - Create budget: $100/month threshold
   - Add email notification

## Troubleshooting

### Lambda Cold Start Slow (>3 seconds)

**Cause**: Large binary size or database connection setup.

**Solution**:
- Check binary size: `ls -lh dist/bootstrap.zip`
- Reduce dependencies in `Cargo.toml`
- Consider Lambda SnapStart (when available for custom runtimes)

### DSQL Connection Timeout

**Cause**: Missing IAM permissions or incorrect connection string.

**Solution**:
```bash
# Test DSQL connection
pulumi stack output dsqlEndpointEast
psql "host=ENDPOINT port=5432 dbname=postgres sslmode=require" -c "SELECT 1"

# Check Lambda IAM role has dsql:DbConnect permission
```

### CloudFront 403 Error

**Cause**: S3 bucket policy or OAI misconfigured.

**Solution**:
```bash
# Verify S3 bucket policy
aws s3api get-bucket-policy --bucket YOUR-DOMAIN-frontend --profile howardtyson

# Verify CloudFront OAI
aws cloudfront list-cloud-front-origin-access-identities --profile howardtyson
```

### Certificate Validation Stuck

**Cause**: DNS records not created or propagation delay.

**Solution**:
```bash
# Check Route 53 for validation CNAME
aws route53 list-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --profile howardtyson | grep _acm-challenge

# Wait 5-10 minutes, then re-run pulumi up
```

### GitHub Actions OIDC Failure

**Cause**: IAM role trust policy incorrect or GitHub repo name mismatch.

**Solution**:
```bash
# Verify GitHub repo format in Pulumi config
pulumi config get githubRepo
# Should be: owner/repo-name (not URL)

# Check IAM role trust policy
aws iam get-role --role-name github-actions-role --profile howardtyson
```

## Maintenance

### Updating Lambda Code

**Via GitHub Actions** (recommended):
```bash
# Make changes to backend/src/**
git add backend/
git commit -m "Update Lambda function"
git push origin main
# GitHub Actions will build and deploy automatically
```

**Manual update**:
```bash
cd backend
cargo lambda build --release --arm64 --output-format zip
cp target/lambda/home-inventory-backend/bootstrap.zip ../infrastructure/dist/
cd ../infrastructure
pulumi up
```

### Updating Frontend

**Via GitHub Actions** (recommended):
```bash
# Make changes to frontend/src/**
git add frontend/
git commit -m "Update frontend"
git push origin main
# GitHub Actions will build and deploy automatically
```

**Manual update**:
```bash
cd frontend
npm run build
aws s3 sync dist/ s3://YOUR-DOMAIN-frontend --delete --profile howardtyson
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*" \
  --profile howardtyson
```

### Database Migrations

Migrations run automatically on Lambda cold start. To manually run:

```bash
# SSH into Lambda or run locally
DATABASE_URL="postgresql://..." cargo run migrate
```

### Monitoring Costs

```bash
# AWS Cost Explorer
# Go to AWS Console → Billing → Cost Explorer
# Filter by service: Lambda, API Gateway, CloudFront, S3, DSQL

# Pulumi stack output
pulumi stack output
```

### Rotating Secrets

```bash
# Update Google OAuth credentials
pulumi config set --secret googleClientId "NEW_CLIENT_ID"
pulumi config set --secret googleClientSecret "NEW_SECRET"
pulumi up

# Update Anthropic API key
pulumi config set --secret anthropicApiKey "NEW_KEY"
pulumi up
```

### Backup and Recovery

**Database backup**:
```bash
# Aurora DSQL has automatic backups
# To export manually:
pg_dump "postgresql://..." > backup.sql
```

**S3 versioning** (enabled by default):
```bash
# List versions
aws s3api list-object-versions --bucket YOUR-DOMAIN-photos --profile howardtyson

# Restore version
aws s3api copy-object \
  --bucket YOUR-DOMAIN-photos \
  --copy-source YOUR-DOMAIN-photos/KEY?versionId=VERSION_ID \
  --key KEY \
  --profile howardtyson
```

### Scaling Considerations

**Current configuration handles:**
- 10,000 requests/month: ~$31-51/month
- 100,000 requests/month: ~$35-55/month
- 1,000,000 requests/month: ~$70-90/month

**If you exceed 1M requests/month:**
1. Consider Aurora Serverless v2 instead of DSQL
2. Enable Lambda reserved concurrency
3. Add CloudFront caching for GET /api/items
4. Consider multi-region frontend S3 buckets

## Summary Checklist

- [ ] AWS account created and CLI configured
- [ ] Domain registered/transferred to Route 53
- [ ] Google OAuth credentials created
- [ ] Anthropic API key obtained
- [ ] S3 bucket for Pulumi state created
- [ ] Pulumi stack initialized and configured
- [ ] Lambda function built and copied to dist/
- [ ] Frontend built
- [ ] Infrastructure deployed via `pulumi up`
- [ ] Frontend deployed to S3
- [ ] DNS propagated (test with `dig`)
- [ ] API health check passes
- [ ] Google OAuth login works
- [ ] GitHub Actions secrets configured
- [ ] Test deployment via GitHub Actions
- [ ] CloudWatch dashboard pinned
- [ ] AWS Budget alert configured

## Next Steps

1. **Test thoroughly**: Create rooms, upload photos, test QR scanning
2. **Monitor costs**: Check AWS Cost Explorer daily for first week
3. **Optimize**: Review CloudWatch metrics and adjust Lambda memory
4. **Document**: Add any custom changes to this guide
5. **Share**: Add your domain URL to the README

## Support

- **Pulumi Issues**: https://github.com/pulumi/pulumi/issues
- **AWS Support**: AWS Support Console (if you have a support plan)
- **Application Issues**: Open issue in GitHub repo

---

**Deployment complete!** 🎉

Your application is now live at `https://your-domain.com`
