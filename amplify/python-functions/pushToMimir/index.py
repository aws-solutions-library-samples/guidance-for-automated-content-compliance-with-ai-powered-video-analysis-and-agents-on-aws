# NOTE: This Mimir integration is a proof of concept to demonstrate the art of the
# possible. It was developed with very restricted access to the Mimir tool and can be
# significantly optimized with full control over Mimir permissions.

"""Push to Mimir — Thin proxy Lambda.

Receives a pre-converted Mimir payload from the frontend, fetches the Mimir
bearer token from SSM, and forwards the payload to the Mimir API.

The conversion from timeline events to Mimir format happens on the frontend
(services/mimir.ts). This Lambda only handles auth and proxying.
"""

import json
import os
import urllib.request
import urllib.error
import boto3

ssm_client = boto3.client('ssm')

MIMIR_API_URL = os.environ.get('MIMIR_API_URL', '')
MIMIR_API_TOKEN_PARAM = os.environ.get('MIMIR_API_TOKEN_PARAM', '')

# Cache token across warm invocations
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


def lambda_handler(event, context):
    """Proxy a Mimir timed metadata push.

    Expected body:
    {
        "mimir_data": { "items": { ... } },
        "item_id": "28d0f4a4-96f4-44a3-9642-58091c9746ec"
    }
    """
    try:
        body = json.loads(event.get('body', '{}'))
        mimir_data = body.get('mimir_data')
        item_id = body.get('item_id', '')

        if not mimir_data or not mimir_data.get('items'):
            return _response(400, {'success': False, 'error': 'No mimir_data provided'})

        if not item_id:
            return _response(400, {'success': False, 'error': 'item_id is required'})

        if not MIMIR_API_URL:
            return _response(500, {'success': False, 'error': 'MIMIR_API_URL is not configured'})

        token = get_mimir_token()
        if not token:
            return _response(500, {
                'success': False,
                'error': f'MIMIR_API_TOKEN not configured in SSM ({MIMIR_API_TOKEN_PARAM})'
            })

        # Forward to Mimir API
        url = f"{MIMIR_API_URL.rstrip('/')}/items/{item_id}/timedMetadata"
        headers = {
            'Content-Type': 'application/json',
            'x-mimir-cognito-id-token': f'Bearer {token}',
        }
        payload = json.dumps(mimir_data).encode('utf-8')
        total_items = len(mimir_data.get('items', {}))

        print(f"Pushing {total_items} items to Mimir: {url}")

        req = urllib.request.Request(url, data=payload, headers=headers, method='PUT')
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read().decode('utf-8')
            return _response(200, {
                'success': True,
                'message': f'Pushed {total_items} compliance items to Mimir',
            })

    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else ''
        print(f"Mimir API error: {e.code} - {error_body}")
        return _response(502, {
            'success': False,
            'error': error_body or str(e),
            'message': 'Mimir API returned an error',
        })

    except Exception as e:
        print(f"Error in push-to-mimir: {e}")
        import traceback
        traceback.print_exc()
        return _response(500, {'success': False, 'error': str(e)})


def _response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(body),
    }
