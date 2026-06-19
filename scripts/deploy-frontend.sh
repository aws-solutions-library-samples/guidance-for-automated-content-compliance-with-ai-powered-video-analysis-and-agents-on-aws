#!/bin/bash
#
# Builds the Next.js frontend as a static site and deploys it to the
# S3 + CloudFront hosting created by the Amplify backend
# (see amplify/frontend-hosting/resources.ts).
#
# What it does:
#   1. Reads the hosting bucket, CloudFront distribution ID, and URL from
#      amplify_outputs.json (written by `npm run sandbox`).
#   2. Builds a static export of the app (STATIC_EXPORT=true npm run build -> out/).
#   3. Syncs out/ to the bucket and invalidates the CloudFront cache.
#
# Prerequisites:
#   - Backend deployed at least once (`npm run sandbox`) so amplify_outputs.json
#     exists and contains the frontend hosting outputs.
#   - AWS CLI configured (`aws configure`) and dependencies installed (`npm install`).
#
# Usage: ./scripts/deploy-frontend.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

OUTPUTS_FILE="$ROOT_DIR/amplify_outputs.json"

# 1. Read hosting details from amplify_outputs.json
if [ ! -f "$OUTPUTS_FILE" ]; then
  echo "Error: amplify_outputs.json not found."
  echo "Deploy the backend first with 'npm run sandbox', then re-run this script."
  exit 1
fi

read_output() {
  node -e "process.stdout.write((require('$OUTPUTS_FILE').custom || {})['$1'] || '')"
}

BUCKET="$(read_output frontendBucketName)"
DISTRIBUTION_ID="$(read_output frontendDistributionId)"
FRONTEND_URL="$(read_output frontendUrl)"

if [ -z "$BUCKET" ] || [ -z "$DISTRIBUTION_ID" ]; then
  echo "Error: frontend hosting outputs not found in amplify_outputs.json."
  echo "Make sure the backend has been redeployed ('npm run sandbox') after adding"
  echo "the frontend hosting resources, so the outputs are regenerated."
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "Error: node_modules not found. Run 'npm install' first."
  exit 1
fi

echo "Frontend deployment"
echo "  Bucket:          $BUCKET"
echo "  Distribution ID: $DISTRIBUTION_ID"
echo "  URL:             $FRONTEND_URL"
echo ""

# 2. Build a static export of the app -> out/
echo "Building static export (STATIC_EXPORT=true npm run build)..."
rm -rf "$ROOT_DIR/out"
STATIC_EXPORT=true npm run build

if [ ! -d "$ROOT_DIR/out" ]; then
  echo "Error: build did not produce an 'out/' directory."
  exit 1
fi
echo ""

# 3. Upload to S3 and invalidate the CloudFront cache
echo "Uploading to s3://$BUCKET ..."
aws s3 sync "$ROOT_DIR/out/" "s3://$BUCKET/" --delete

echo "Invalidating CloudFront cache ..."
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text

echo ""
echo "Done. Frontend deployed to:"
echo "  $FRONTEND_URL"
echo ""
echo "Note: a CloudFront invalidation can take a few minutes to fully propagate."
