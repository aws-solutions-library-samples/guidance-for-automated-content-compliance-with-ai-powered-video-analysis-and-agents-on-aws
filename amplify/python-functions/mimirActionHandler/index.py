# NOTE: This Mimir integration is a proof of concept to demonstrate the art of the
# possible. It was developed with very restricted access to the Mimir tool and can be
# significantly optimized with full control over Mimir permissions (e.g. direct S3
# cross-account copy instead of download-then-upload via presigned URLs).

# TODO: The download/upload flow takes longer than API Gateway's 29-second timeout,
# causing Mimir to show a timeout error even though the Lambda completes successfully.

"""MIMIR Custom Action Handler.

Handles requests from MIMIR's custom action menu. Downloads the video via the
Mimir API's presigned highRes URL and uploads it to the app's assets/video/
prefix, which triggers the compliance analysis workflow via S3 event notification.

Exposed via API Gateway with API key auth (x-api-key header).
"""

import json
import os
import boto3
import uuid
import urllib.request
import urllib.error
from urllib.parse import urlparse, unquote

s3_client = boto3.client('s3')
ssm_client = boto3.client('ssm')

DESTINATION_BUCKET = os.environ.get('DESTINATION_BUCKET')
VIDEO_ASSETS_PATH = 'assets/video'
MIMIR_API_URL = os.environ.get('MIMIR_API_URL', '')
MIMIR_API_TOKEN_PARAM = os.environ.get('MIMIR_API_TOKEN_PARAM', '')

_cached_token = None


def get_mimir_token():
    """Fetch the Mimir bearer token from SSM, with in-memory caching."""
    global _cached_token
    if _cached_token:
        return _cached_token
    if not MIMIR_API_TOKEN_PARAM:
        return ''
    try:
        response = ssm_client.get_parameter(Name=MIMIR_API_TOKEN_PARAM, WithDecryption=True)
        _cached_token = response['Parameter']['Value']
        return _cached_token
    except Exception as e:
        print(f"Warning: Could not read SSM parameter {MIMIR_API_TOKEN_PARAM}: {e}")
        return ''


def get_mimir_item(item_id):
    """Call the Mimir API to get item details including the presigned highRes URL."""
    if not MIMIR_API_URL or not item_id:
        return None
    token = get_mimir_token()
    if not token:
        print("Cannot look up Mimir item: no API token configured")
        return None
    url = f"{MIMIR_API_URL.rstrip('/')}/items/{item_id}"
    headers = {
        'Accept': 'application/json',
        'x-mimir-cognito-id-token': f'Bearer {token}',
    }
    try:
        print(f"Looking up item {item_id} from Mimir API: {url}")
        req = urllib.request.Request(url, headers=headers, method='GET')
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error looking up item {item_id}: {e}")
        return None


def download_from_url(url, dest_path):
    """Download a file from a URL to a local path."""
    print(f"Downloading to {dest_path}...")
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req, timeout=600) as resp:
        with open(dest_path, 'wb') as f:
            while True:
                chunk = resp.read(8 * 1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
    file_size = os.path.getsize(dest_path)
    print(f"Download complete: {file_size / (1024*1024):.1f} MB")
    return file_size


def extract_filename(item_data, item_id):
    """Extract a filename from Mimir item data."""
    filename = item_data.get('originalFileName')
    if filename:
        return filename
    title = item_data.get('metadata', {}).get('formData', {}).get('default_title')
    if title:
        return title
    high_res = item_data.get('highRes', '')
    if high_res:
        parsed = urlparse(high_res)
        path_filename = unquote(parsed.path.split('/')[-1])
        if path_filename and '.' in path_filename:
            return path_filename
    return f"{item_id}.mp4"


def upload_to_s3(local_path, bucket, key, tagging=None):
    """Upload a local file to S3 with optional tagging."""
    print(f"Uploading to s3://{bucket}/{key}...")
    extra_args = {}
    if tagging:
        extra_args['Tagging'] = tagging
    s3_client.upload_file(local_path, bucket, key, ExtraArgs=extra_args if extra_args else None)
    print(f"Upload complete: s3://{bucket}/{key}")


def lambda_handler(event, context):
    """Handle a MIMIR custom action request via API Gateway."""
    try:
        body = json.loads(event.get('body', '{}'))

        external_id = body.get('externalId')
        items = body.get('items', [])
        action_data = body.get('actionData', {})
        user_id = body.get('userId')
        user_email = body.get('userEmail')

        print(f"Received MIMIR action request:")
        print(f"  External ID: {external_id}")
        print(f"  User ID: {user_id}")
        print(f"  User Email: {user_email}")
        print(f"  Items count: {len(items)}")
        print(f"  Action Data: {json.dumps(action_data)}")

        if not DESTINATION_BUCKET:
            raise ValueError("DESTINATION_BUCKET environment variable is not set")

        # Use compliance-user-id query param as the identity prefix for S3 uploads.
        # Function URL puts query params in event.queryStringParameters
        query_params = event.get('queryStringParameters') or {}
        compliance_user_id = query_params.get('compliance-user-id', '')
        if compliance_user_id:
            print(f"  Compliance User ID (from query param): {compliance_user_id}")

        processed_items = []
        for item in items:
            item_type = item.get('itemType')
            item_id = item.get('id')

            if item_type == 'folder':
                folder_name = item.get('name')
                print(f"Skipping folder: {folder_name} (ID: {item_id})")
                processed_items.append({
                    'id': item_id,
                    'type': 'folder',
                    'name': folder_name,
                    'status': 'skipped',
                    'message': 'Folders are not copied'
                })
                continue

            metadata = item.get('metadata', {})
            form_data = metadata.get('formData', {})
            title = form_data.get('default_title', 'Unknown')

            try:
                item_data = get_mimir_item(item_id)
                if not item_data:
                    processed_items.append({
                        'id': item_id, 'type': item_type, 'title': title,
                        'status': 'error', 'message': 'Could not look up item from Mimir API'
                    })
                    continue

                high_res_url = item_data.get('highRes')
                if not high_res_url:
                    processed_items.append({
                        'id': item_id, 'type': item_type, 'title': title,
                        'status': 'error', 'message': 'No highRes URL available for this item'
                    })
                    continue

                original_filename = extract_filename(item_data, item_id)
                file_extension = original_filename.rsplit('.', 1)[-1] if '.' in original_filename else 'mp4'
                session_id = str(uuid.uuid4())
                s3_filename = f"{session_id}.{file_extension}"
                identity_id = compliance_user_id or user_id
                if not identity_id:
                    raise ValueError("No identity ID available — set compliance-user-id query param or userId in the request body")
                destination_key = f"{VIDEO_ASSETS_PATH}/{identity_id}/{s3_filename}"

                local_path = f"/tmp/{s3_filename}"
                download_from_url(high_res_url, local_path)

                tag_parts = [
                    f"OriginalFilename={original_filename}",
                    f"SessionId={session_id}",
                    "ContentType=Film",
                ]
                if item_id:
                    tag_parts.append(f"MimirItemId={item_id}")
                tagging = '&'.join(tag_parts)

                upload_to_s3(local_path, DESTINATION_BUCKET, destination_key, tagging=tagging)
                os.remove(local_path)

                processed_items.append({
                    'id': item_id, 'type': item_type, 'title': title,
                    'status': 'copied', 'sessionId': session_id,
                    'destinationKey': destination_key, 'destinationBucket': DESTINATION_BUCKET
                })

            except Exception as item_error:
                print(f"Error processing item {item_id}: {str(item_error)}")
                import traceback
                traceback.print_exc()
                processed_items.append({
                    'id': item_id, 'type': item_type, 'title': title,
                    'status': 'error', 'message': str(item_error)
                })
                try:
                    if os.path.exists(local_path):
                        os.remove(local_path)
                except:
                    pass

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'success': True,
                'message': f'Processed {len(processed_items)} items',
                'externalId': external_id,
                'userId': user_id,
                'userEmail': user_email,
                'processedItems': processed_items
            })
        }

    except Exception as e:
        print(f"Error processing MIMIR action: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'success': False, 'error': str(e),
                'message': 'Failed to process MIMIR action'
            })
        }
