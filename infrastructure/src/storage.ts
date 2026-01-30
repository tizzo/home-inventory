import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { StackConfig, RegionProviders, StorageOutputs, IAMOutputs } from "./types.js";

export function createStorage(
  config: StackConfig,
  providers: RegionProviders,
  iamOutputs: IAMOutputs
): StorageOutputs {
  // Frontend S3 bucket
  const frontendBucket = new aws.s3.BucketV2(
    "frontend",
    {
      bucket: `${config.domainName}-frontend`,
    },
    { provider: providers.east }
  );

  // Block all public access (CloudFront will access via OAI)
  new aws.s3.BucketPublicAccessBlock(
    "frontend-pab",
    {
      bucket: frontendBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    },
    { provider: providers.east }
  );

  // Origin Access Identity for CloudFront
  const oai = new aws.cloudfront.OriginAccessIdentity("oai", {
    comment: "OAI for frontend S3 bucket",
  });

  // Bucket policy: Allow CloudFront OAI to read
  new aws.s3.BucketPolicy(
    "frontend-policy",
    {
      bucket: frontendBucket.id,
      policy: pulumi
        .all([frontendBucket.arn, oai.iamArn])
        .apply(([bucketArn, oaiArn]) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { AWS: oaiArn },
                Action: "s3:GetObject",
                Resource: `${bucketArn}/*`,
              },
            ],
          })
        ),
    },
    { provider: providers.east }
  );

  // Photos bucket with versioning (required for replication)
  const photoBucket = new aws.s3.BucketV2(
    "photos",
    {
      bucket: `${config.domainName}-photos`,
    },
    { provider: providers.east }
  );

  new aws.s3.BucketVersioningV2(
    "photos-versioning",
    {
      bucket: photoBucket.id,
      versioningConfiguration: { status: "Enabled" },
    },
    { provider: providers.east }
  );

  // Replica bucket in us-east-2
  const photoBucketReplica = new aws.s3.BucketV2(
    "photos-replica",
    {
      bucket: `${config.domainName}-photos-replica`,
    },
    { provider: providers.west }
  );

  new aws.s3.BucketVersioningV2(
    "photos-replica-versioning",
    {
      bucket: photoBucketReplica.id,
      versioningConfiguration: { status: "Enabled" },
    },
    { provider: providers.west }
  );

  // S3 replication policy
  new aws.iam.RolePolicy("s3-replication-policy", {
    role: iamOutputs.s3ReplicationRole.id,
    policy: pulumi
      .all([photoBucket.arn, photoBucketReplica.arn])
      .apply(([sourceArn, destArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:GetReplicationConfiguration", "s3:ListBucket"],
              Resource: sourceArn,
            },
            {
              Effect: "Allow",
              Action: [
                "s3:GetObjectVersionForReplication",
                "s3:GetObjectVersionAcl",
              ],
              Resource: `${sourceArn}/*`,
            },
            {
              Effect: "Allow",
              Action: ["s3:ReplicateObject", "s3:ReplicateDelete"],
              Resource: `${destArn}/*`,
            },
          ],
        })
      ),
  }, { provider: providers.east });

  // Replication configuration
  new aws.s3.BucketReplicationConfig(
    "photos-replication",
    {
      bucket: photoBucket.id,
      role: iamOutputs.s3ReplicationRole.arn,
      rules: [
        {
          id: "replicate-all",
          status: "Enabled",
          destination: {
            bucket: photoBucketReplica.arn,
            storageClass: "STANDARD_IA", // Cheaper storage for replica
          },
        },
      ],
    },
    { provider: providers.east }
  );

  return {
    frontendBucket,
    photoBucket,
    photoBucketReplica,
    oai,
  };
}
