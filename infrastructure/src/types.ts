import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface StackConfig {
  domainName: string;
  githubRepo: string;
  googleClientId: pulumi.Output<string>;
  googleClientSecret: pulumi.Output<string>;
  anthropicApiKey: pulumi.Output<string>;
}

export interface RegionProviders {
  east: aws.Provider;
  west: aws.Provider;
}

export interface DatabaseOutputs {
  dsqlClusterEast: aws.dsql.Cluster;
  dsqlClusterWest: aws.dsql.Cluster;
  connectionStringEast: pulumi.Output<string>;
  connectionStringWest: pulumi.Output<string>;
}

export interface StorageOutputs {
  frontendBucket: aws.s3.BucketV2;
  photoBucket: aws.s3.BucketV2;
  photoBucketReplica: aws.s3.BucketV2;
  oai: aws.cloudfront.OriginAccessIdentity;
}

export interface LambdaOutputs {
  lambdaEast: aws.lambda.Function;
  lambdaWest: aws.lambda.Function;
  apiEast: aws.apigatewayv2.Api;
  apiWest: aws.apigatewayv2.Api;
  apiEndpointEast: pulumi.Output<string>;
  apiEndpointWest: pulumi.Output<string>;
}

export interface IAMOutputs {
  lambdaRole: aws.iam.Role;
  githubActionsRole: aws.iam.Role;
  s3ReplicationRole: aws.iam.Role;
}

export interface CloudFrontOutputs {
  distribution: aws.cloudfront.Distribution;
  certificate: aws.acm.Certificate;
  distributionDomainName: pulumi.Output<string>;
  distributionId: pulumi.Output<string>;
}
