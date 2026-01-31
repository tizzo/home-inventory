import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { RegionProviders, LambdaOutputs } from "./types.js";

export function createMonitoring(
  providers: RegionProviders,
  lambda: LambdaOutputs
): void {
  // CloudWatch log groups for Lambda functions
  new aws.cloudwatch.LogGroup(
    "lambda-logs-east-1",
    {
      name: pulumi.interpolate`/aws/lambda/${lambda.lambdaEast.name}`,
      retentionInDays: 7,
    },
    { provider: providers.east }
  );

  new aws.cloudwatch.LogGroup(
    "lambda-logs-east-2",
    {
      name: pulumi.interpolate`/aws/lambda/${lambda.lambdaWest.name}`,
      retentionInDays: 7,
    },
    { provider: providers.west }
  );

  // Lambda error rate alarm (us-east-1)
  new aws.cloudwatch.MetricAlarm(
    "lambda-errors-east-1",
    {
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2,
      metricName: "Errors",
      namespace: "AWS/Lambda",
      period: 300,
      statistic: "Sum",
      threshold: 10,
      alarmDescription: "Lambda errors exceed 10 in 10 minutes",
      dimensions: { FunctionName: lambda.lambdaEast.name },
    },
    { provider: providers.east }
  );

  // Lambda duration alarm (us-east-1)
  new aws.cloudwatch.MetricAlarm(
    "lambda-duration-east-1",
    {
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2,
      metricName: "Duration",
      namespace: "AWS/Lambda",
      period: 300,
      statistic: "Maximum",
      threshold: 25000,
      alarmDescription: "Lambda duration approaching timeout",
      dimensions: { FunctionName: lambda.lambdaEast.name },
    },
    { provider: providers.east }
  );

  // Lambda error rate alarm (us-east-2)
  new aws.cloudwatch.MetricAlarm(
    "lambda-errors-east-2",
    {
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2,
      metricName: "Errors",
      namespace: "AWS/Lambda",
      period: 300,
      statistic: "Sum",
      threshold: 10,
      alarmDescription: "Lambda errors exceed 10 in 10 minutes",
      dimensions: { FunctionName: lambda.lambdaWest.name },
    },
    { provider: providers.west }
  );

  // Lambda duration alarm (us-east-2)
  new aws.cloudwatch.MetricAlarm(
    "lambda-duration-east-2",
    {
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2,
      metricName: "Duration",
      namespace: "AWS/Lambda",
      period: 300,
      statistic: "Maximum",
      threshold: 25000,
      alarmDescription: "Lambda duration approaching timeout",
      dimensions: { FunctionName: lambda.lambdaWest.name },
    },
    { provider: providers.west }
  );

  // CloudWatch dashboard
  new aws.cloudwatch.Dashboard("monitoring-dashboard", {
    dashboardName: "home-inventory-prod",
    dashboardBody: JSON.stringify({
      widgets: [
        {
          type: "metric",
          properties: {
            metrics: [
              [
                "AWS/Lambda",
                "Invocations",
                { stat: "Sum", label: "Total Invocations" },
              ],
              [".", "Errors", { stat: "Sum", label: "Errors" }],
              [
                ".",
                "Duration",
                { stat: "Average", label: "Avg Duration (ms)" },
              ],
            ],
            period: 300,
            stat: "Average",
            region: "us-east-1",
            title: "Lambda Metrics (us-east-1)",
          },
        },
        {
          type: "metric",
          properties: {
            metrics: [
              ["AWS/CloudFront", "Requests", { stat: "Sum" }],
              [".", "BytesDownloaded", { stat: "Sum" }],
              [".", "4xxErrorRate", { stat: "Average" }],
              [".", "5xxErrorRate", { stat: "Average" }],
            ],
            period: 300,
            stat: "Average",
            region: "us-east-1",
            title: "CloudFront Metrics",
          },
        },
      ],
    }),
  });
}
