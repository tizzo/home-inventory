import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { IAMOutputs, RegionProviders } from "./types.js";

const SERVICE_ROLE_BOUNDARY =
  "arn:aws:iam::168450803450:policy/home-inventory-service-role-boundary";

export function createIAMResources(
  photoBucketArn: pulumi.Output<string>,
  dsqlClusterEastArn: pulumi.Output<string>,
  dsqlClusterWestArn: pulumi.Output<string>,
  providers: RegionProviders
): IAMOutputs {
  // Lambda execution role
  // Note: IAM is global but we use east provider to apply default tags
  const lambdaRole = new aws.iam.Role("lambda-execution-role", {
    // Capped by a boundary managed in aws-foundation; the CI deploy role may only
    // create or change roles that carry it.
    permissionsBoundary: SERVICE_ROLE_BOUNDARY,
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    }),
  }, { provider: providers.east });

  // CloudWatch Logs permission for Lambda
  new aws.iam.RolePolicyAttachment("lambda-logs", {
    role: lambdaRole.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  }, { provider: providers.east });

  // S3 access for photos
  new aws.iam.RolePolicy("lambda-s3-policy", {
    role: lambdaRole.id,
    policy: photoBucketArn.apply((bucketArn) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
            Resource: `${bucketArn}/*`,
          },
          {
            Effect: "Allow",
            Action: ["s3:ListBucket"],
            Resource: bucketArn,
          },
        ],
      })
    ),
  }, { provider: providers.east });

  // DSQL access
  new aws.iam.RolePolicy("lambda-dsql-policy", {
    role: lambdaRole.id,
    policy: pulumi.all([dsqlClusterEastArn, dsqlClusterWestArn]).apply(([eastArn, westArn]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["dsql:DbConnect", "dsql:DbConnectAdmin"],
            Resource: [eastArn, westArn],
          },
        ],
      })
    ),
  }, { provider: providers.east });

  // X-Ray tracing (optional but recommended)
  new aws.iam.RolePolicyAttachment("lambda-xray", {
    role: lambdaRole.name,
    policyArn: "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess",
  }, { provider: providers.east });

  // GitHub Actions deploys through the gha-home-inventory role in
  // tizzo/aws-foundation, which also scopes what it may manage here. The GitHub
  // OIDC provider is shared by every repo, so this stack no longer owns it.

  // S3 replication role
  const s3ReplicationRole = new aws.iam.Role("s3-replication-role", {
    // Capped by a boundary managed in aws-foundation; the CI deploy role may only
    // create or change roles that carry it.
    permissionsBoundary: SERVICE_ROLE_BOUNDARY,
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "s3.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    }),
  }, { provider: providers.east });

  return {
    lambdaRole,
    s3ReplicationRole,
  };
}
