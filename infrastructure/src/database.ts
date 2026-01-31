import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { RegionProviders, DatabaseOutputs } from "./types.js";

export function createDatabase(providers: RegionProviders): DatabaseOutputs {
  // Primary DSQL cluster in us-east-1
  const dsqlClusterEast = new aws.dsql.Cluster(
    "inventory-dsql-east",
    {
      // DSQL cluster configuration
      deletionProtectionEnabled: false, // Set to true in production
    },
    { provider: providers.east }
  );

  // Linked DSQL cluster in us-east-2 for multi-region support
  const dsqlClusterWest = new aws.dsql.Cluster(
    "inventory-dsql-west",
    {
      // Note: Multi-region linking configured via AWS console or separate peering resource
      deletionProtectionEnabled: false, // Set to true in production
    },
    { provider: providers.west }
  );

  // Connection strings for Lambda environment variables
  // Note: DSQL endpoint format: <cluster-id>.dsql.<region>.on.aws
  const connectionStringEast = pulumi.interpolate`postgresql://admin@${dsqlClusterEast.identifier}.dsql.us-east-1.on.aws:5432/postgres?sslmode=require`;

  const connectionStringWest = pulumi.interpolate`postgresql://admin@${dsqlClusterWest.identifier}.dsql.us-east-2.on.aws:5432/postgres?sslmode=require`;

  return {
    dsqlClusterEast,
    dsqlClusterWest,
    connectionStringEast,
    connectionStringWest,
  };
}
