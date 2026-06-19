# MIMIR Action Handler

MIMIR supports "custom actions" — configurable menu items that appear on assets in the MIMIR UI. When a user right-clicks an asset and selects a custom action, MIMIR sends a POST request to a configured API endpoint with details about the selected asset(s).

This Lambda function handles that request. It copies the referenced video asset from MIMIR's S3 storage into the application's `assets/video/` prefix, which triggers the existing S3 event notification on that prefix and automatically kicks off the full compliance analysis workflow (Step Functions with frame analysis, transcription, Bedrock agents, etc.) — no manual upload through the web UI required.

## How It Works

1. MIMIR sends a POST request to `/mimir-action` with a payload containing media items and their `s3_uri` locations.
2. The handler copies each video from the source S3 location into `assets/video/{userId}/{filename}` in the app's storage bucket.
3. The existing S3 `OBJECT_CREATED` event notification on the `assets/video/` prefix triggers `startComplianceWorkflowFunction`, which launches the full analysis pipeline.

The `DESTINATION_BUCKET` environment variable (set automatically in `backend.ts`) tells the handler which S3 bucket to copy into — the Amplify-managed storage bucket where the rest of the app expects video assets.

## API Endpoint

```
POST https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/mimir-action
```

Protected by Cognito authentication. The endpoint URL is available in Amplify outputs after deployment.

## Request Payload

```json
{
  "externalId": "string (optional)",
  "userId": "string (optional, used as the S3 identity prefix)",
  "userEmail": "string (optional)",
  "userToken": "string (optional)",
  "actionData": {
    "s3_uri": "s3://source-bucket/path/to/video.mp4"
  },
  "items": []
}
```

The `s3_uri` can be provided at the top level in `actionData` (applies to all items), per-item in `actionData`, or in an item's `metadata`.

### Item Types

**ItemDto** (media items — these get copied):
```json
{
  "id": "string",
  "itemType": "video | image | person | audio | file | clipList",
  "metadata": {
    "formId": "string",
    "s3_uri": "s3://bucket/key (optional, fallback if not in actionData)",
    "formData": {
      "default_title": "string",
      "default_description": "string",
      "default_createdOn": "string"
    }
  }
}
```

**FolderDto** (folders — skipped, not copied):
```json
{
  "id": "string",
  "itemType": "folder",
  "name": "string"
}
```

## Example Request

```bash
curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/mimir-action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {cognito-id-token}" \
  -d '{
    "externalId": "ext-12345",
    "userId": "user-789",
    "userEmail": "[email]",
    "actionData": {
      "s3_uri": "s3://mimir-source-bucket/media/sample-video.mp4"
    },
    "items": [
      {
        "id": "video-001",
        "itemType": "video",
        "metadata": {
          "formId": "form-123",
          "formData": {
            "default_title": "Sample Video",
            "default_description": "A sample video for compliance review",
            "default_createdOn": "2024-01-15T10:30:00Z"
          }
        }
      }
    ]
  }'
```

## Response

### Success (200)

Each item includes a `status` of `copied`, `skipped`, or `error`:

```json
{
  "success": true,
  "message": "Processed 2 items",
  "externalId": "ext-12345",
  "userId": "user-789",
  "processedItems": [
    {
      "id": "video-001",
      "type": "video",
      "title": "Sample Video",
      "status": "copied",
      "sourceUri": "s3://mimir-source-bucket/media/sample-video.mp4",
      "destinationKey": "assets/video/user-789/sample-video.mp4",
      "destinationBucket": "my-app-bucket"
    },
    {
      "id": "folder-001",
      "type": "folder",
      "name": "Media Assets",
      "status": "skipped",
      "message": "Folders are not copied"
    }
  ]
}
```

### Error (500)

```json
{
  "success": false,
  "error": "Error message details",
  "message": "Failed to process MIMIR action"
}
```

## Authentication

The endpoint uses Cognito authentication. Include a valid Cognito ID token in the `Authorization` header.

## IAM Permissions

The handler's execution role is granted:
- `s3:PutObject` and `s3:PutObjectTagging` on `assets/video/*` in the destination bucket
- `s3:GetObject` on `arn:aws:s3:::*/*` (to read from any source bucket MIMIR references)

## Infrastructure

Defined in:
- `amplify/python-functions/resources.ts` — Lambda function definition (`mimirActionHandlerFunction`)
- `amplify/backend.ts` — API Gateway resource, Cognito auth, S3 permissions, and environment variables (inside the `// MIMIR Integration` comment block)
