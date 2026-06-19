import { RemovalPolicy, Duration, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { vars } from '../global-variables';

/**
 * Static hosting for the Next.js frontend.
 *
 * Creates a private S3 bucket (no public access) fronted by a CloudFront
 * distribution using Origin Access Control (OAC). The statically exported app
 * (`STATIC_EXPORT=true npm run build`, output in `out/`) is uploaded to the
 * bucket by `scripts/deploy-frontend.sh`.
 *
 * Naming: the physical bucket name is left to CloudFormation so it is globally
 * unique and stays within S3's 63-character limit — the same approach the
 * Amplify-managed assets bucket uses. The logical/standard name follows the
 * `APP_PREFIX` convention (`vars.FRONTEND_S3_BUCKET_NAME`) and is applied as a
 * resource tag and the CloudFront comment for identification.
 */
export class FrontendHostingConstruct extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const branch = process.env.AWS_BRANCH || 'default';
    const standardName = `${vars.FRONTEND_S3_BUCKET_NAME}-${branch}`;

    // Private origin bucket — only reachable through CloudFront via OAC.
    this.bucket = new s3.Bucket(this, 'FrontendHostingBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Accelerator/sandbox friendly: tears down cleanly with `ampx sandbox delete`.
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    Tags.of(this.bucket).add('Name', standardName);

    // The static export uses `trailingSlash: true`, so routes are stored as
    // `route/index.html`. This viewer-request function rewrites "directory"
    // requests (ending in `/`, or extension-less paths like `/config`) to the
    // matching `index.html` object so deep links resolve correctly.
    const directoryIndexFunction = new cloudfront.Function(this, 'DirectoryIndexRewrite', {
      comment: `${standardName}-dir-index`,
      code: cloudfront.FunctionCode.fromInline(
        [
          'function handler(event) {',
          '  var request = event.request;',
          '  var uri = request.uri;',
          "  if (uri.charAt(uri.length - 1) === '/') {",
          "    request.uri = uri + 'index.html';",
          '  } else {',
          "    var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);",
          "    if (lastSegment.indexOf('.') === -1) {",
          "      request.uri = uri + '/index.html';",
          '    }',
          '  }',
          '  return request;',
          '}',
        ].join('\n')
      ),
    });

    this.distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      comment: standardName,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: directoryIndexFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      // SPA fallback: the dynamic route `/analyze/analysis-results/[sessionId]`
      // isn't pre-rendered for arbitrary IDs, so missing objects (S3 returns 403
      // under OAC) fall back to index.html and the client router renders the page.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
      ],
    });
  }
}
