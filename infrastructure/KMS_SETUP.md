# KMS Secrets Encryption Setup

This project uses AWS KMS (Key Management Service) to encrypt Pulumi secrets instead of passphrases.

## Why KMS Instead of Passphrase?

**Benefits:**
- ✅ No passphrase to remember or rotate
- ✅ IAM-based access control (who can decrypt secrets)
- ✅ Audit trail in CloudTrail (who accessed secrets when)
- ✅ Better for CI/CD (GitHub Actions uses IAM role)
- ✅ Automatic key rotation (if enabled)
- ✅ Compliance-ready (FIPS 140-2 validated)

**Cost:**
- $1/month per KMS key
- $0.03 per 10,000 requests
- Negligible for typical usage (~100 requests/month = $0.0003)

## Setup

### 1. Create KMS Key and Alias

```bash
# Create KMS key
KEY_ID=$(aws kms create-key \
  --description "Pulumi secrets encryption for home-inventory" \
  --profile howardtyson \
  --query 'KeyMetadata.KeyId' \
  --output text)

# Create alias (easier to reference)
aws kms create-alias \
  --alias-name alias/pulumi-home-inventory \
  --target-key-id $KEY_ID \
  --profile howardtyson

# Verify
aws kms describe-key \
  --key-id alias/pulumi-home-inventory \
  --profile howardtyson
```

### 2. Initialize Pulumi Stack with KMS

```bash
cd infrastructure

# Login to S3 backend
pulumi login s3://home-inventory-pulumi-state

# Create stack with KMS secrets provider
pulumi stack init prod \
  --secrets-provider="awskms://alias/pulumi-home-inventory?region=us-east-1"
```

**What this does:**
- Configures Pulumi to use KMS for encrypting/decrypting secrets
- Secrets in `Pulumi.prod.yaml` are encrypted with the KMS key
- No passphrase needed

### 3. Configure Secrets

```bash
# Set secrets (will be encrypted with KMS)
pulumi config set --secret googleClientId "YOUR_CLIENT_ID"
pulumi config set --secret googleClientSecret "YOUR_SECRET"
pulumi config set --secret anthropicApiKey "YOUR_KEY"

# View config (secrets are encrypted)
cat Pulumi.prod.yaml
```

**Example `Pulumi.prod.yaml`:**
```yaml
config:
  aws:profile: howardtyson
  aws:region: us-east-1
  home-inventory-infrastructure:domainName: example.com
  home-inventory-infrastructure:githubRepo: owner/repo
  home-inventory-infrastructure:googleClientId:
    secure: AQICAHg...encrypted...base64...
  home-inventory-infrastructure:googleClientSecret:
    secure: AQICAHg...encrypted...base64...
  home-inventory-infrastructure:anthropicApiKey:
    secure: AQICAHg...encrypted...base64...
```

## IAM Permissions

### Required Permissions

Your IAM user/role needs these KMS permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_ID"
    },
    {
      "Effect": "Allow",
      "Action": "kms:ListAliases",
      "Resource": "*"
    }
  ]
}
```

### Grant Access to IAM User

```bash
# Get your IAM user ARN
aws sts get-caller-identity --profile howardtyson

# Add key policy to grant access to your IAM user
aws kms put-key-policy \
  --key-id alias/pulumi-home-inventory \
  --policy-name default \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "Enable IAM User Permissions",
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::ACCOUNT_ID:root"
        },
        "Action": "kms:*",
        "Resource": "*"
      },
      {
        "Sid": "Allow use of the key",
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::ACCOUNT_ID:user/YOUR_USER"
        },
        "Action": [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:DescribeKey"
        ],
        "Resource": "*"
      }
    ]
  }' \
  --profile howardtyson
```

**Note:** The GitHub Actions OIDC role automatically gets KMS permissions via the IAM policy in `infrastructure/src/iam.ts`.

## GitHub Actions

### No Additional Setup Required

The GitHub Actions workflow automatically uses the OIDC IAM role, which has KMS permissions.

**What happens:**
1. GitHub Actions assumes the IAM role via OIDC
2. IAM role has `kms:Decrypt` and `kms:Encrypt` permissions
3. Pulumi decrypts secrets from `Pulumi.prod.yaml` using KMS
4. Deployment proceeds with decrypted secrets

**No GitHub secrets needed for Pulumi secrets!**

## Troubleshooting

### Error: "AccessDeniedException: User is not authorized to perform: kms:Decrypt"

**Cause:** Your IAM user/role doesn't have KMS permissions.

**Solution:**
```bash
# Add KMS permissions to your IAM user
aws iam put-user-policy \
  --user-name YOUR_USER \
  --policy-name PulumiKMSAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["kms:Decrypt", "kms:Encrypt", "kms:DescribeKey"],
        "Resource": "arn:aws:kms:us-east-1:ACCOUNT_ID:key/*"
      }
    ]
  }' \
  --profile howardtyson
```

### Error: "Key 'alias/pulumi-home-inventory' not found"

**Cause:** KMS alias doesn't exist.

**Solution:**
```bash
# List existing aliases
aws kms list-aliases --profile howardtyson

# Create alias if missing
aws kms create-alias \
  --alias-name alias/pulumi-home-inventory \
  --target-key-id YOUR_KEY_ID \
  --profile howardtyson
```

### Changing KMS Key

If you need to use a different KMS key:

```bash
# Change secrets provider
pulumi stack change-secrets-provider \
  "awskms://alias/new-key-name?region=us-east-1"
```

This will re-encrypt all secrets with the new key.

## Security Best Practices

1. **Enable Key Rotation**:
   ```bash
   aws kms enable-key-rotation \
     --key-id alias/pulumi-home-inventory \
     --profile howardtyson
   ```

2. **Restrict Key Usage** (modify key policy):
   - Only allow specific IAM users/roles
   - Require MFA for key administration
   - Enable CloudTrail logging

3. **Monitor Key Usage**:
   ```bash
   # View CloudTrail events for KMS key usage
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=ResourceName,AttributeValue=alias/pulumi-home-inventory \
     --profile howardtyson
   ```

4. **Backup Key Metadata**:
   ```bash
   # Export key ID (store securely)
   aws kms describe-key \
     --key-id alias/pulumi-home-inventory \
     --query 'KeyMetadata.KeyId' \
     --output text \
     --profile howardtyson
   ```

## Cost Estimate

**Monthly cost:**
- KMS key: $1.00/month
- KMS requests: ~100 requests/month × $0.03/10,000 = $0.0003/month
- **Total: ~$1.00/month**

**Annual cost:** ~$12/year

## Comparison: KMS vs Passphrase

| Feature | KMS | Passphrase |
|---------|-----|------------|
| **Cost** | $1/month | Free |
| **Security** | IAM-based, audited | Shared secret |
| **Rotation** | Automatic (if enabled) | Manual |
| **CI/CD** | Seamless (IAM role) | Requires secret management |
| **Audit Trail** | CloudTrail logs | None |
| **Compliance** | FIPS 140-2 | No |
| **Setup Complexity** | Medium | Simple |
| **Team Sharing** | IAM permissions | Share passphrase |

**Recommendation:** Use KMS for production, passphrase for local development/testing.

## References

- [Pulumi AWS KMS Secrets Provider](https://www.pulumi.com/docs/concepts/secrets/#aws-key-management-service)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [KMS Pricing](https://aws.amazon.com/kms/pricing/)
- [CloudTrail KMS Events](https://docs.aws.amazon.com/kms/latest/developerguide/logging-using-cloudtrail.html)
