# AWS Resource Tagging

All AWS resources created by this Pulumi infrastructure are automatically tagged for cost tracking, resource management, and compliance.

## Default Tags

Every resource gets these tags:

```typescript
{
  project: "home-inventory",
  managedBy: "pulumi",
  environment: "production"
}
```

## Implementation

Tags are applied via **AWS Provider default tags** in `index.ts`:

```typescript
const defaultTags = {
  tags: {
    project: "home-inventory",
    managedBy: "pulumi",
    environment: "production",
  },
};

const providers: RegionProviders = {
  east: new aws.Provider("east", {
    region: "us-east-1",
    defaultTags,
  }),
  west: new aws.Provider("west", {
    region: "us-east-2",
    defaultTags,
  }),
};
```

All resources must use one of these providers to receive tags.

## Tagged Resources

The following resources are automatically tagged:

### Infrastructure (created before Pulumi)
- ✅ S3 bucket for Pulumi state (`home-inventory-pulumi-state`)
  - Tagged by `scripts/setup.sh` via AWS CLI
  - Additional tag: `purpose: pulumi-state`
- ✅ KMS key for Pulumi secrets (`alias/pulumi-home-inventory`)
  - Tagged by `scripts/setup.sh` via AWS CLI
  - Additional tag: `purpose: pulumi-secrets`

### Compute (us-east-1, us-east-2)
- ✅ Lambda functions (`backend-east-1`, `backend-east-2`)
- ✅ API Gateway HTTP APIs

### Database (us-east-1, us-east-2)
- ✅ Aurora DSQL clusters

### Storage (us-east-1, us-east-2)
- ✅ S3 buckets (frontend, photos, photos-replica)
- ✅ S3 bucket configurations (versioning, replication, etc.)

### CDN & DNS (global/us-east-1)
- ✅ CloudFront distribution
- ✅ CloudFront Origin Access Identity
- ✅ Route 53 records
- ✅ ACM certificate

### IAM (global)
- ✅ IAM roles (Lambda execution, GitHub Actions OIDC, S3 replication)
- ✅ IAM policies (inline policies attached to roles)
- ⚠️  IAM policy attachments (managed policies don't support tags)
- ⚠️  OIDC provider (doesn't support tags)

### Monitoring (us-east-1, us-east-2)
- ✅ CloudWatch log groups
- ✅ CloudWatch metric alarms
- ✅ CloudWatch dashboard

## Verifying Tags

After deployment, verify tags are applied:

```bash
# Check Pulumi state S3 bucket tags
aws s3api get-bucket-tagging \
  --bucket home-inventory-pulumi-state \
  --profile howardtyson

# Check KMS key tags
aws kms list-resource-tags \
  --key-id alias/pulumi-home-inventory \
  --profile howardtyson

# Check Lambda function tags (after Pulumi deployment)
aws lambda list-tags \
  --resource $(pulumi stack output lambdaFunctionNameEast | xargs -I {} aws lambda get-function --function-name {} --query 'Configuration.FunctionArn' --output text) \
  --profile howardtyson

# Check frontend S3 bucket tags
aws s3api get-bucket-tagging \
  --bucket $(pulumi stack output frontendBucketName) \
  --profile howardtyson

# Check IAM role tags
aws iam list-role-tags \
  --role-name lambda-execution-role \
  --profile howardtyson
```

Expected output:
```json
{
  "Tags": [
    {
      "Key": "project",
      "Value": "home-inventory"
    },
    {
      "Key": "managedBy",
      "Value": "pulumi"
    },
    {
      "Key": "environment",
      "Value": "production"
    }
  ]
}
```

## Cost Tracking

Use tags to filter costs in AWS Cost Explorer:

1. Go to **AWS Console** → **Billing** → **Cost Explorer**
2. Click **Filters** → **Tag**
3. Select `project` = `home-inventory`
4. View all costs for this project

You can also create a **Cost Allocation Report** filtered by the `project` tag.

## Resource Management

Find all resources for this project:

```bash
# Using AWS CLI
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=project,Values=home-inventory \
  --profile howardtyson

# Count resources by service
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=project,Values=home-inventory \
  --profile howardtyson \
  --query 'ResourceTagMappingList[].ResourceARN' \
  --output text | awk -F: '{print $3}' | sort | uniq -c
```

## Resource Groups

Create an AWS Resource Group for easy management:

```bash
aws resource-groups create-group \
  --name home-inventory-prod \
  --resource-query '{
    "Type": "TAG_FILTERS_1_0",
    "Query": "{\"ResourceTypeFilters\":[\"AWS::AllSupported\"],\"TagFilters\":[{\"Key\":\"project\",\"Values\":[\"home-inventory\"]}]}"
  }' \
  --profile howardtyson
```

Then view in AWS Console → **Resource Groups** → **home-inventory-prod**

## Customizing Tags

To add or modify tags, edit `index.ts`:

```typescript
const defaultTags = {
  tags: {
    project: "home-inventory",
    managedBy: "pulumi",
    environment: "production",
    // Add custom tags:
    owner: "your-name",
    costCenter: "personal",
    compliance: "none",
  },
};
```

Then run `pulumi up` to apply changes.

## Tag Limitations

Some AWS resources don't support tags:

- **IAM Policy Attachments**: Uses managed policies (not taggable)
- **OIDC Provider**: Doesn't support tags
- **Route 53 Hosted Zone**: Pre-existing (not managed by Pulumi)

These resources are still part of the project but can't be tagged.

## Compliance

Tags support compliance requirements:

- **FinOps**: Track costs by project/environment
- **Security**: Identify resources by project for security audits
- **Operations**: Filter resources in CloudWatch, AWS Config
- **Inventory**: Automated resource discovery and documentation

## Best Practices

✅ **Do:**
- Always use the `east` or `west` providers for resources
- Keep tag keys and values consistent
- Use tags for cost allocation
- Document any additional custom tags

❌ **Don't:**
- Create resources without specifying a provider
- Use spaces in tag keys (use camelCase or snake_case)
- Mix tag naming conventions
- Remove the `project` tag (required for cost tracking)

## Troubleshooting

### Resource not tagged

**Cause**: Resource created without specifying provider.

**Solution**:
```typescript
// Wrong (no provider, won't get tags)
new aws.s3.BucketV2("bucket", { bucket: "name" });

// Correct (uses provider with default tags)
new aws.s3.BucketV2("bucket", { bucket: "name" }, { provider: providers.east });
```

### Tags not showing in AWS Console

**Cause**: Tag propagation can take a few minutes.

**Solution**: Wait 5-10 minutes, then refresh the AWS Console.

### Cost Explorer not showing tag

**Cause**: Cost allocation tags must be activated.

**Solution**:
1. Go to **AWS Console** → **Billing** → **Cost Allocation Tags**
2. Find `project` tag
3. Click **Activate**
4. Wait 24 hours for data to populate

## References

- [AWS Tagging Best Practices](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/tagging-best-practices.html)
- [Pulumi AWS Provider Default Tags](https://www.pulumi.com/registry/packages/aws/api-docs/provider/#default_tags)
- [AWS Cost Allocation Tags](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html)
