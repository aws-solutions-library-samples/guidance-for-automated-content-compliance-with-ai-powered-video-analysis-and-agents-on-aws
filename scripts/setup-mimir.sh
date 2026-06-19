#!/bin/bash
#
# Configures shared Mimir SSM parameters and creates the API Gateway key.
# All params are stored under /shared/ — run once per AWS account.
#
#   1. Custom Action Key — the x-api-key value Mimir sends to your /mimir-action endpoint.
#      An API Gateway key is created (or reused) with this value and its ID stored in
#      /shared/MIMIR_API_KEY_ID for CDK to import.
#
#   2. API Token — the bearer token your Lambda uses to push data to the Mimir API.
#      Read at runtime from SSM. Takes effect immediately, no redeploy needed.
#
# Usage: ./scripts/setup-mimir.sh
#

set -e

REGION=$(aws configure get region 2>/dev/null)
if [ -z "$REGION" ]; then
  echo "Error: No default region configured in AWS CLI. Run 'aws configure' first."
  exit 1
fi

echo "Mimir Setup (shared, account-wide)"
echo "  Region: $REGION"
echo ""

# 1. Custom Action Key
read -rp "Mimir Custom Action Key (x-api-key for /mimir-action): " ACTION_KEY
if [ -z "$ACTION_KEY" ]; then
  echo "Skipping custom action key (empty)."
else
  aws ssm put-parameter \
    --name "/shared/MIMIR_CUSTOM_ACTION_KEY" \
    --value "$ACTION_KEY" \
    --type String \
    --region "$REGION" \
    --overwrite
  echo "  Saved /shared/MIMIR_CUSTOM_ACTION_KEY"

  # Create or reuse an API Gateway key with this value.
  # API Gateway requires key values to be unique per account, so if a key with
  # this value already exists we reuse it.
  EXISTING_KEY_ID=$(aws apigateway get-api-keys \
    --include-values \
    --region "$REGION" \
    --query "items[?value=='${ACTION_KEY}'].id | [0]" \
    --output text 2>/dev/null)

  if [ "$EXISTING_KEY_ID" != "None" ] && [ -n "$EXISTING_KEY_ID" ]; then
    echo "  Reusing existing API Gateway key: $EXISTING_KEY_ID"
    API_KEY_ID="$EXISTING_KEY_ID"
  else
    API_KEY_ID=$(aws apigateway create-api-key \
      --name "mimir-custom-action-key" \
      --description "Shared Mimir custom action API key" \
      --enabled \
      --value "$ACTION_KEY" \
      --region "$REGION" \
      --query "id" \
      --output text)
    echo "  Created API Gateway key: $API_KEY_ID"
  fi

  aws ssm put-parameter \
    --name "/shared/MIMIR_API_KEY_ID" \
    --value "$API_KEY_ID" \
    --type String \
    --region "$REGION" \
    --overwrite
  echo "  Saved /shared/MIMIR_API_KEY_ID = $API_KEY_ID"
fi

echo ""

# 2. API Token
read -rp "Mimir API Token (bearer token for pushing to Mimir): " API_TOKEN
if [ -z "$API_TOKEN" ]; then
  echo "Skipping API token (empty)."
else
  aws ssm put-parameter \
    --name "/shared/MIMIR_API_TOKEN" \
    --value "$API_TOKEN" \
    --type SecureString \
    --region "$REGION" \
    --overwrite
  echo "  Saved /shared/MIMIR_API_TOKEN"
fi

echo ""
echo "Done. Run 'npm run sandbox' to deploy."
