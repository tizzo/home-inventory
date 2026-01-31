import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {
  StackConfig,
  RegionProviders,
  DatabaseOutputs,
  IAMOutputs,
  StorageOutputs,
  LambdaOutputs,
} from "./types.js";

export function createLambdaFunctions(
  config: StackConfig,
  providers: RegionProviders,
  database: DatabaseOutputs,
  storage: StorageOutputs,
  iamOutputs: IAMOutputs
): LambdaOutputs {
  // Lambda function configuration (shared between regions)
  const lambdaConfig = {
    runtime: "provided.al2023" as aws.lambda.Runtime,
    architectures: ["arm64"],
    handler: "bootstrap",
    memorySize: 512,
    timeout: 30,
    role: iamOutputs.lambdaRole.arn,
    tracingConfig: { mode: "Active" as const }, // Enable X-Ray
  };

  // Lambda function in us-east-1
  const lambdaEast = new aws.lambda.Function(
    "backend-east-1",
    {
      ...lambdaConfig,
      code: new pulumi.asset.FileArchive("./dist/bootstrap.zip"),
      environment: {
        variables: {
          DATABASE_URL: database.connectionStringEast,
          GOOGLE_CLIENT_ID: config.googleClientId,
          GOOGLE_CLIENT_SECRET: config.googleClientSecret,
          GOOGLE_REDIRECT_URL: pulumi.interpolate`https://${config.domainName}/api/auth/callback`,
          APP_BASE_URL: pulumi.interpolate`https://${config.domainName}`,
          ANTHROPIC_API_KEY: config.anthropicApiKey,
          S3_BUCKET: storage.photoBucket.id,
          S3_REGION: "us-east-1",
          RUST_LOG: "info",
          // AWS_LAMBDA_FUNCTION_NAME is automatically set by AWS Lambda
        },
      },
    },
    { provider: providers.east }
  );

  // Lambda function in us-east-2
  const lambdaWest = new aws.lambda.Function(
    "backend-east-2",
    {
      ...lambdaConfig,
      code: new pulumi.asset.FileArchive("./dist/bootstrap.zip"),
      environment: {
        variables: {
          DATABASE_URL: database.connectionStringWest,
          GOOGLE_CLIENT_ID: config.googleClientId,
          GOOGLE_CLIENT_SECRET: config.googleClientSecret,
          GOOGLE_REDIRECT_URL: pulumi.interpolate`https://${config.domainName}/api/auth/callback`,
          APP_BASE_URL: pulumi.interpolate`https://${config.domainName}`,
          ANTHROPIC_API_KEY: config.anthropicApiKey,
          S3_BUCKET: storage.photoBucketReplica.id,
          S3_REGION: "us-east-2",
          RUST_LOG: "info",
          // AWS_LAMBDA_FUNCTION_NAME is automatically set by AWS Lambda
        },
      },
    },
    { provider: providers.west }
  );

  // API Gateway HTTP API for us-east-1
  const apiEast = new aws.apigatewayv2.Api(
    "api-east-1",
    {
      protocolType: "HTTP",
      corsConfiguration: {
        allowOrigins: [pulumi.interpolate`https://${config.domainName}`],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "Cookie"],
        allowCredentials: true,
      },
    },
    { provider: providers.east }
  );

  // Lambda integration for us-east-1
  const integrationEast = new aws.apigatewayv2.Integration(
    "lambda-integration-east-1",
    {
      apiId: apiEast.id,
      integrationType: "AWS_PROXY",
      integrationUri: lambdaEast.arn,
      payloadFormatVersion: "2.0",
    },
    { provider: providers.east }
  );

  // Default route for us-east-1
  new aws.apigatewayv2.Route(
    "default-route-east-1",
    {
      apiId: apiEast.id,
      routeKey: "$default",
      target: pulumi.interpolate`integrations/${integrationEast.id}`,
    },
    { provider: providers.east }
  );

  // Auto-deploy stage for us-east-1
  new aws.apigatewayv2.Stage(
    "prod-east-1",
    {
      apiId: apiEast.id,
      name: "$default",
      autoDeploy: true,
    },
    { provider: providers.east }
  );

  // Grant API Gateway invoke permission for us-east-1
  new aws.lambda.Permission(
    "api-invoke-east-1",
    {
      action: "lambda:InvokeFunction",
      function: lambdaEast.name,
      principal: "apigateway.amazonaws.com",
      sourceArn: pulumi.interpolate`${apiEast.executionArn}/*/*`,
    },
    { provider: providers.east }
  );

  // API Gateway HTTP API for us-east-2
  const apiWest = new aws.apigatewayv2.Api(
    "api-east-2",
    {
      protocolType: "HTTP",
      corsConfiguration: {
        allowOrigins: [pulumi.interpolate`https://${config.domainName}`],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "Cookie"],
        allowCredentials: true,
      },
    },
    { provider: providers.west }
  );

  // Lambda integration for us-east-2
  const integrationWest = new aws.apigatewayv2.Integration(
    "lambda-integration-east-2",
    {
      apiId: apiWest.id,
      integrationType: "AWS_PROXY",
      integrationUri: lambdaWest.arn,
      payloadFormatVersion: "2.0",
    },
    { provider: providers.west }
  );

  // Default route for us-east-2
  new aws.apigatewayv2.Route(
    "default-route-east-2",
    {
      apiId: apiWest.id,
      routeKey: "$default",
      target: pulumi.interpolate`integrations/${integrationWest.id}`,
    },
    { provider: providers.west }
  );

  // Auto-deploy stage for us-east-2
  new aws.apigatewayv2.Stage(
    "prod-east-2",
    {
      apiId: apiWest.id,
      name: "$default",
      autoDeploy: true,
    },
    { provider: providers.west }
  );

  // Grant API Gateway invoke permission for us-east-2
  new aws.lambda.Permission(
    "api-invoke-east-2",
    {
      action: "lambda:InvokeFunction",
      function: lambdaWest.name,
      principal: "apigateway.amazonaws.com",
      sourceArn: pulumi.interpolate`${apiWest.executionArn}/*/*`,
    },
    { provider: providers.west }
  );

  return {
    lambdaEast,
    lambdaWest,
    apiEast,
    apiWest,
    apiEndpointEast: apiEast.apiEndpoint,
    apiEndpointWest: apiWest.apiEndpoint,
  };
}
