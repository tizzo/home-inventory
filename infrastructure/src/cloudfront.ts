import * as aws from "@pulumi/aws";
import {
  StackConfig,
  RegionProviders,
  StorageOutputs,
  LambdaOutputs,
  CloudFrontOutputs,
} from "./types.js";

export function createCloudFront(
  config: StackConfig,
  providers: RegionProviders,
  storage: StorageOutputs,
  lambda: LambdaOutputs
): CloudFrontOutputs {
  // ACM certificate MUST be in us-east-1 for CloudFront
  const certificate = new aws.acm.Certificate(
    "cdn-cert",
    {
      domainName: config.domainName,
      validationMethod: "DNS",
    },
    { provider: providers.east }
  );

  // Get existing Route 53 hosted zone for the base domain
  // Extract base domain from subdomain (e.g., inventory.howardandcara.com -> howardandcara.com)
  const baseDomain = config.domainName.split('.').slice(-2).join('.');
  const hostedZone = aws.route53.getZoneOutput({
    name: baseDomain,
  });

  // DNS validation records
  const certValidation = new aws.route53.Record("cert-validation", {
    zoneId: hostedZone.zoneId,
    name: certificate.domainValidationOptions.apply((opts) => opts[0]?.resourceRecordName || ""),
    type: certificate.domainValidationOptions.apply((opts) => opts[0]?.resourceRecordType || "CNAME"),
    records: certificate.domainValidationOptions.apply((opts) => [opts[0]?.resourceRecordValue || ""]),
    ttl: 60,
  }, { provider: providers.east });

  // Wait for certificate validation
  new aws.acm.CertificateValidation(
    "cert-validation-complete",
    {
      certificateArn: certificate.arn,
      validationRecordFqdns: [certValidation.fqdn],
    },
    { provider: providers.east }
  );

  // CloudFront distribution
  // Note: CloudFront is global but we use east provider to apply default tags
  const distribution = new aws.cloudfront.Distribution("cdn", {
    enabled: true,
    defaultRootObject: "index.html",
    aliases: [config.domainName],

    origins: [
      // Origin 1: S3 static frontend
      {
        originId: "s3-frontend",
        domainName: storage.frontendBucket.bucketRegionalDomainName,
        s3OriginConfig: {
          originAccessIdentity: storage.oai.cloudfrontAccessIdentityPath,
        },
      },
      // Origin 2: API Gateway us-east-1
      {
        originId: "api-east-1",
        domainName: lambda.apiEndpointEast.apply((endpoint) =>
          endpoint.replace("https://", "")
        ),
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: "https-only",
          originSslProtocols: ["TLSv1.2"],
        },
      },
      // Origin 3: API Gateway us-east-2
      {
        originId: "api-east-2",
        domainName: lambda.apiEndpointWest.apply((endpoint) =>
          endpoint.replace("https://", "")
        ),
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: "https-only",
          originSslProtocols: ["TLSv1.2"],
        },
      },
    ],

    // Note: Origin groups don't support POST/PUT/PATCH/DELETE methods
    // Using single API origin for now (us-east-1)
    // TODO: Add Route 53 health check failover later

    // Default behavior: Serve frontend from S3
    defaultCacheBehavior: {
      targetOriginId: "s3-frontend",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD", "OPTIONS"],
      cachedMethods: ["GET", "HEAD"],
      forwardedValues: {
        queryString: false,
        cookies: { forward: "none" },
      },
      compress: true,
      minTtl: 0,
      defaultTtl: 86400,
      maxTtl: 31536000,
    },

    // API behavior: Proxy to Lambda (no caching)
    orderedCacheBehaviors: [
      {
        pathPattern: "/api/*",
        targetOriginId: "api-east-1", // Using primary region (no origin group failover)
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: [
          "DELETE",
          "GET",
          "HEAD",
          "OPTIONS",
          "PATCH",
          "POST",
          "PUT",
        ],
        cachedMethods: ["GET", "HEAD"],
        forwardedValues: {
          queryString: true,
          headers: ["Authorization", "Origin", "Referer"],
          cookies: { forward: "all" }, // Cookies forwarded via this config, not headers
        },
        minTtl: 0,
        defaultTtl: 0,
        maxTtl: 0,
      },
    ],

    // SPA routing: Serve index.html for 404s
    customErrorResponses: [
      { errorCode: 404, responseCode: 200, responsePagePath: "/index.html" },
      { errorCode: 403, responseCode: 200, responsePagePath: "/index.html" },
    ],

    // ACM certificate
    viewerCertificate: {
      acmCertificateArn: certificate.arn,
      sslSupportMethod: "sni-only",
      minimumProtocolVersion: "TLSv1.2_2021",
    },

    restrictions: {
      geoRestriction: { restrictionType: "none" },
    },
  }, { provider: providers.east });

  // Create A record pointing to CloudFront
  new aws.route53.Record("cdn-alias", {
    zoneId: hostedZone.zoneId,
    name: config.domainName,
    type: "A",
    aliases: [
      {
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  }, { provider: providers.east });

  // Create AAAA record (IPv6)
  new aws.route53.Record("cdn-alias-ipv6", {
    zoneId: hostedZone.zoneId,
    name: config.domainName,
    type: "AAAA",
    aliases: [
      {
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  }, { provider: providers.east });

  return {
    distribution,
    certificate,
    distributionDomainName: distribution.domainName,
    distributionId: distribution.id,
  };
}
