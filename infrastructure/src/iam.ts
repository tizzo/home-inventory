import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { StackConfig, IAMOutputs, RegionProviders } from "./types.js";

export function createIAMResources(
  config: StackConfig,
  photoBucketArn: pulumi.Output<string>,
  dsqlClusterEastArn: pulumi.Output<string>,
  dsqlClusterWestArn: pulumi.Output<string>,
  providers: RegionProviders
): IAMOutputs {
  // Lambda execution role
  // Note: IAM is global but we use east provider to apply default tags
  const lambdaRole = new aws.iam.Role("lambda-execution-role", {
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

  // GitHub OIDC provider
  const githubOIDC = new aws.iam.OpenIdConnectProvider("github-oidc", {
    url: "https://token.actions.githubusercontent.com",
    clientIdLists: ["sts.amazonaws.com"],
    thumbprintLists: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
  }, { provider: providers.east });

  // GitHub Actions role
  const githubActionsRole = new aws.iam.Role("github-actions-role", {
    assumeRolePolicy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": { "Federated": "${githubOIDC.arn}" },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:${config.githubRepo}:*"
          }
        }
      }]
    }`,
  }, { provider: providers.east });

  // Broad permissions for initial deployment (narrow down later)
  new aws.iam.RolePolicyAttachment("github-admin", {
    role: githubActionsRole.name,
    policyArn: "arn:aws:iam::aws:policy/AdministratorAccess",
  }, { provider: providers.east });

  // KMS permissions for Pulumi secrets encryption/decryption
  new aws.iam.RolePolicy("github-kms-policy", {
    role: githubActionsRole.id,
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["kms:Decrypt", "kms:Encrypt", "kms:DescribeKey"],
          Resource: "arn:aws:kms:*:*:key/*",
          Condition: {
            StringEquals: {
              "kms:RequestAlias": "alias/pulumi-home-inventory",
            },
          },
        },
        {
          Effect: "Allow",
          Action: ["kms:ListAliases"],
          Resource: "*",
        },
      ],
    }),
  }, { provider: providers.east });

  // S3 replication role
  const s3ReplicationRole = new aws.iam.Role("s3-replication-role", {
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
    githubActionsRole,
    s3ReplicationRole,
  };
}
