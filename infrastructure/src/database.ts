import * as pulumi from "@pulumi/pulumi";
import * as awsNative from "@pulumi/aws-native";
import { DatabaseOutputs, DsqlClusterCompat } from "./types.js";

export function createDatabase(): DatabaseOutputs {
  // Multi-region DSQL cluster setup using aws-native provider
  //
  // IMPORTANT: This is a TWO-PHASE deployment process:
  //
  // Phase 1 (Initial deployment):
  //   - Creates both clusters with witnessRegion only
  //   - Clusters will be in PENDING_SETUP state
  //   - Run: pulumi up
  //   - Note the cluster ARNs from the outputs
  //
  // Phase 2 (Link clusters):
  //   - Uncomment the `clusters` arrays below and add the ARNs
  //   - Run: pulumi up again
  //   - Clusters will transition to ACTIVE and be fully linked
  //
  // For now, we're using the aws-native provider which properly supports multiRegionProperties.

  const config = new pulumi.Config();

  // These will be populated after Phase 1
  const eastClusterArn = config.get("eastClusterArn") || "";
  const westClusterArn = config.get("westClusterArn") || "";

  // Primary DSQL cluster in us-east-1
  const dsqlClusterEast = new awsNative.dsql.Cluster(
    "inventory-dsql-east",
    {
      deletionProtectionEnabled: false, // Set to true in production
      multiRegionProperties: {
        witnessRegion: "us-west-2",
        // Phase 1: Keep this empty
        // Phase 2: Uncomment and add west cluster ARN after Phase 1 completes
        ...(westClusterArn ? { clusters: [westClusterArn] } : {}),
      },
    },
    {
      provider: new awsNative.Provider("aws-native-east", { region: "us-east-1" }),
    }
  );

  // Secondary DSQL cluster in us-east-2
  const dsqlClusterWest = new awsNative.dsql.Cluster(
    "inventory-dsql-west",
    {
      deletionProtectionEnabled: false, // Set to true in production
      multiRegionProperties: {
        witnessRegion: "us-west-2",
        // Phase 1: Keep this empty
        // Phase 2: Uncomment and add east cluster ARN after Phase 1 completes
        ...(eastClusterArn ? { clusters: [eastClusterArn] } : {}),
      },
    },
    {
      provider: new awsNative.Provider("aws-native-west", { region: "us-east-2" }),
    }
  );

  // For compatibility with existing code, create wrapper objects that match the generic interface
  const dsqlClusterEastCompat: DsqlClusterCompat = {
    identifier: dsqlClusterEast.identifier,
    arn: dsqlClusterEast.resourceArn,
  };

  const dsqlClusterWestCompat: DsqlClusterCompat = {
    identifier: dsqlClusterWest.identifier,
    arn: dsqlClusterWest.resourceArn,
  };

  // Connection strings for Lambda environment variables
  // Note: DSQL endpoint format: <cluster-id>.dsql.<region>.on.aws
  const connectionStringEast = pulumi.interpolate`postgresql://admin@${dsqlClusterEast.identifier}.dsql.us-east-1.on.aws:5432/postgres?sslmode=require`;

  const connectionStringWest = pulumi.interpolate`postgresql://admin@${dsqlClusterWest.identifier}.dsql.us-east-2.on.aws:5432/postgres?sslmode=require`;

  return {
    dsqlClusterEast: dsqlClusterEastCompat,
    dsqlClusterWest: dsqlClusterWestCompat,
    connectionStringEast,
    connectionStringWest,
  };
}
