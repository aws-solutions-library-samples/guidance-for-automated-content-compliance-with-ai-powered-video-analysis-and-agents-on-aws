/** @type {import('next').NextConfig} */

// When STATIC_EXPORT=true the app is built as a fully static site (output: 'export')
// into the `out/` directory, suitable for hosting on Amazon S3 + CloudFront.
// This is what `scripts/deploy-frontend.sh` uses.
//
// When STATIC_EXPORT is unset, the default Next.js build (`.next`) is produced so
// the existing local `npm run dev` workflow and the AWS Amplify Hosting (SSR)
// pipeline in `amplify.yml` continue to work unchanged.
const isStaticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig = isStaticExport
  ? {
      output: 'export',
      // CloudFront/S3 serve each route as `route/index.html`, which keeps clean URLs.
      trailingSlash: true,
      // next/image optimization needs a server; disable it for a static export.
      images: { unoptimized: true },
    }
  : {};

module.exports = nextConfig;
