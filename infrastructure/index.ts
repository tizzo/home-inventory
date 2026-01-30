import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {StackConfig, RegionProviders} from "./src/types.js";
import {createIAMResources} from "./src/iam.js";
import {createDatabase} from "./src/database.js";
import {createStorage} from "./src/storage.js";
import {createLambdaFunctions} from "./src/lambda.js";
import {createCloudFront} from "./src/cloudfront.js";
import {createMonitoring} from "./src/monitoring.js";

// Load Pulumi configuration
const config = new pulumi.Config();

const stackConfig: StackConfig = {
  domainName: config.require("domainName"),
  githubRepo: config.require("githubRepo"),
  googleClientId: config.requireSecret("googleClientId"),
  googleClientSecret: config.requireSecret("googleClientSecret"),
  anthropicApiKey: config.requireSecret("anthropicApiKey"),
};

// Create AWS providers for each region with default tags
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

// Phase 1: Create DSQL database first
const databaseOutputs = createDatabase(providers);

// Phase 2: Create IAM roles (now with proper DSQL ARNs)
// We need to create a placeholder bucket ARN for the initial IAM setup
const photoBucketArnPlaceholder = pulumi.output(
  `arn:aws:s3:::${stackConfig.domainName}-photos`
);

const iamOutputs = createIAMResources(
  stackConfig,
  photoBucketArnPlaceholder,
  databaseOutputs.dsqlClusterEast.arn,
  databaseOutputs.dsqlClusterWest.arn,
  providers
);

// Phase 3: Create S3 buckets
const storageOutputs = createStorage(stackConfig, providers, iamOutputs);

// Phase 4: Create Lambda functions and API Gateway
const lambdaOutputs = createLambdaFunctions(
  stackConfig,
  providers,
  databaseOutputs,
  storageOutputs,
  iamOutputs
);

// Phase 5: Create CloudFront distribution
const cloudFrontOutputs = createCloudFront(
  stackConfig,
  providers,
  storageOutputs,
  lambdaOutputs
);

// Phase 6: Create monitoring resources
createMonitoring(providers, lambdaOutputs);

// Export important values for GitHub Actions and manual reference
export const githubActionsRoleArn = iamOutputs.githubActionsRole.arn;
export const frontendBucketName = storageOutputs.frontendBucket.id;
export const photoBucketName = storageOutputs.photoBucket.id;
export const cloudFrontDistributionId = cloudFrontOutputs.distributionId;
export const cloudFrontDomainName = cloudFrontOutputs.distributionDomainName;
export const apiEndpointEast = lambdaOutputs.apiEndpointEast;
export const apiEndpointWest = lambdaOutputs.apiEndpointWest;
export const dsqlEndpointEast = databaseOutputs.dsqlClusterEast.identifier.apply(
  (id) => `${id}.dsql.us-east-1.on.aws`
);
export const dsqlEndpointWest = databaseOutputs.dsqlClusterWest.identifier.apply(
  (id) => `${id}.dsql.us-east-2.on.aws`
);
export const lambdaFunctionNameEast = lambdaOutputs.lambdaEast.name;
export const lambdaFunctionNameWest = lambdaOutputs.lambdaWest.name;
export const websiteUrl = pulumi.interpolate`https://${stackConfig.domainName}`;
