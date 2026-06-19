import boto3
import os
from datetime import datetime, timedelta, timezone
import json

# params are static between deployments, so it is ok to cache these
params_cache = None

def get_branch():
    return os.environ['AWS_BRANCH']

def get_parameters():
    global params_cache
    if params_cache:
        return params_cache

    ssm = boto3.client('ssm')
    params = {}
    next_token = None
    
    while True:
        if next_token:
            response = ssm.get_parameters_by_path(
                Path='/' + get_branch() + '/',
                WithDecryption=True,
                NextToken=next_token
            )
        else:
            response = ssm.get_parameters_by_path(
                Path='/' + get_branch() + '/',
                WithDecryption=True
            )
        
        for param in response['Parameters']:
            name = param['Name'].split('/')[-1]
            params[name] = param['Value']
        
        next_token = response.get('NextToken')
        if not next_token:
            break
        
    params_cache = params     
    return params_cache 

def extract_identity_from_path(s3_object_key):
    """
    Extract identity ID from S3 object path
    Expected format: assets/video/{identity_id}/{filename}
    """
    try:
        path_parts = s3_object_key.split('/')
        if len(path_parts) >= 3 and path_parts[0] == 'assets' and path_parts[1] == 'video':
            return path_parts[2]
    except Exception:
        pass
    
    raise ValueError("No identity ID found in S3 object path")

def extract_session_from_object(bucket, s3_object_key):
    return get_tag_value(bucket, s3_object_key, 'SessionId')

def get_fps(bucket, s3_object_key):
    try:
        content_type = get_tag_value(bucket, s3_object_key, 'ContentType')
        config, config_type = get_relevant_config(bucket, s3_object_key)
        return max(1, int(config['defaultFramesPerSecond'][content_type]))
    except ValueError as e:
        return 1

def get_tag_value(bucket, object, tag, should_exception=True):
    tags_response = boto3.client('s3').get_object_tagging(Bucket=bucket,Key=object)
    
    tag_set = tags_response.get('TagSet', [])
    wanted_tag = next((t for t in tag_set if t['Key'] == tag), None)
    if wanted_tag and wanted_tag.get('Value'):
        return wanted_tag['Value']
    
    if should_exception:
        raise ValueError(f"No {tag} found in S3 object tags")
    return None

def set_tag_value(bucket, object, tag, value):
    s3 = boto3.client('s3')
    tags_response = s3.get_object_tagging(Bucket=bucket, Key=object)

    tag_set = tags_response.get('TagSet', [])
    new_tag_set = []
    
    for t in tag_set:
        if t['Key'] != tag:
            new_tag_set.append(t)
            
    new_tag_set.append({'Key': tag, 'Value': value})

    s3.put_object_tagging(
        Bucket=bucket,
        Key=object,
        Tagging={
            'TagSet': new_tag_set
        }
    )

def extract_filename_from_path(s3_object_key):
    return s3_object_key.split('/')[-1].split('.')[0]

def log_output_message(s3_bucket, s3_object_key, message, message_type='info'):
    """
    Log output message to DynamoDB.
    """
    try:
        
        log_output_table = get_parameters()['LOG_OUTPUT_TABLE']
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(log_output_table)

        # Calculate TTL for 1 day from now
        ttl = int((datetime.now() + timedelta(days=1)).timestamp())

        # Format to ISO and replace +00:00 with "Z"
        iso_format_z = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        
        table.put_item(
            Item={
                'sessionId': extract_session_from_object(s3_bucket, s3_object_key),
                'createdAt': iso_format_z,
                'updatedAt': iso_format_z,
                'message': message,
                'type': message_type,
                'identityId': extract_identity_from_path(s3_object_key),
                'ttl': ttl
            }
        )
    except Exception as e:
        print(f"Error logging to output table: {str(e)}")

def save_workflow_time(bucket, s3_object_key, execution_start_time):
    """Calculate and persist workflow time to the analysis results table."""
    try:
        dynamodb = boto3.client('dynamodb')
        analysis_results_table = get_parameters()['ANALYSIS_RESULTS_TABLE']
        session_id = extract_session_from_object(bucket, s3_object_key)

        start_time = datetime.fromisoformat(execution_start_time.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        workflow_time = (now - start_time).total_seconds()

        dynamodb.update_item(
            TableName=analysis_results_table,
            Key={'sessionId': {'S': session_id}},
            UpdateExpression='SET #wt = :wt, updatedAt = :now',
            ExpressionAttributeNames={'#wt': 'workflowTime'},
            ExpressionAttributeValues={
                ':wt': {'N': str(round(workflow_time, 2))},
                ':now': {'S': now.isoformat(timespec='milliseconds').replace('+00:00', 'Z')}
            }
        )
        print(f"Saved workflow time: {workflow_time:.2f}s for session {session_id}")
    except Exception as e:
        print(f"Error saving workflow time: {str(e)}")

def save_statistics(session_id: str, identity_id: str, input_tokens: int, output_tokens: int, 
                   input_token_cost: float, output_token_cost: float, model_id: str, model: str, processing_time: float, 
                   model_provider: str, processing_type: str, content_type: str, duration: float):
    """
    Save statistics to DynamoDB Statistics table
    """
    statistics_table = get_parameters()['STATISTICS_TABLE']

    try:
        iso_format_z = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        
        item = {
            'sessionId': {'S': session_id},
            'identityId': {'S': identity_id},
            'inputTokens': {'N': str(input_tokens)},
            'inputTokenCost': {'N': str(input_token_cost)},
            'outputTokens': {'N': str(output_tokens)},
            'outputTokenCost': {'N': str(output_token_cost)},
            'modelId': {'S': model_id},
            'model': {'S': model},
            'processingTime': {'N': str(processing_time)},
            'modelProvider': {'S': model_provider},
            'processingType': {'S': processing_type.value if hasattr(processing_type, 'value') else str(processing_type)},
            'contentType': {'S': content_type},
            'duration': {'N': str(duration)},
            'createdAt': {'S': iso_format_z},
            'updatedAt': {'S': iso_format_z}
        }
        
        boto3.client('dynamodb').put_item(TableName=statistics_table, Item=item)
        print(f'Successfully saved statistics to {statistics_table}')
    except Exception as error:
        print(f'Error saving statistics: {str(error)}')        

def calculate_model_cost(model_id: str, input_tokens: int, output_tokens: int, seconds_of_video: int = 0):
    """
    Calculate token costs and get model provider based on model ID.
    All pricing values are based on On-Demand pricing for the us-west-2 region.
    If deploying to a different region or using a different pricing model,
    update the pricing values accordingly.
    See: https://aws.amazon.com/bedrock/pricing/
    """
    model_pricing = {
        'us.amazon.nova-lite-v1:0': {'provider': 'Amazon', 'model': 'Nova Lite', 'input': 0.00006, 'output': 0.00024},
        'global.amazon.nova-2-lite-v1:0': {'provider': 'Amazon', 'model': 'Nova 2 Lite', 'input': 0.0003, 'output': 0.0025},
        'us.amazon.nova-pro-v1:0': {'provider': 'Amazon', 'model': 'Nova Pro', 'input': 0.0008, 'output': 0.0032},
        'us.amazon.nova-2-pro-preview-20251202-v1:0': {'provider': 'Amazon', 'model': 'Nova 2 Pro Preview', 'input': 0.00125, 'output': 0.01},
        'us.amazon.nova-premier-v1:0': {'provider': 'Amazon', 'model': 'Nova Premier', 'input': 0.0025, 'output': 0.0125},
        'us.anthropic.claude-3-haiku-20240307-v1:0': {'provider': 'Anthropic', 'model': 'Claude 3 Haiku', 'input': 0.00025, 'output': 0.00125},
        'us.anthropic.claude-3-7-sonnet-20250219-v1:0': {'provider': 'Anthropic', 'model': 'Claude 3.7 Sonnet', 'input': 0.003, 'output': 0.015},
        'global.anthropic.claude-sonnet-4-20250514-v1:0': {'provider': 'Anthropic', 'model': 'Claude 4 Sonnet', 'input': 0.003, 'output': 0.015},
        'global.anthropic.claude-sonnet-4-5-20250929-v1:0': {'provider': 'Anthropic', 'model': 'Claude 4.5 Sonnet', 'input': 0.003, 'output': 0.015},
        'global.anthropic.claude-sonnet-4-6': {'provider': 'Anthropic', 'model': 'Claude 4.6 Sonnet', 'input': 0.003, 'output': 0.015},
        'global.anthropic.claude-opus-4-6-v1': {'provider': 'Anthropic', 'model': 'Claude 4.6 Opus', 'input': 0.005, 'output': 0.025},
        'us.twelvelabs.pegasus-1-2-v1:0': {'provider': 'Twelve Labs', 'model': 'Pegasus 1.2', 'input': 0.00049, 'output': 0.0075} # per second of video = input cost
    }

    if model_id in model_pricing:
        pricing = model_pricing[model_id]
        if model_id == 'us.twelvelabs.pegasus-1-2-v1:0':
            input_cost = seconds_of_video * pricing['input']
        else:
            input_cost = (input_tokens / 1000) * pricing['input']
        output_cost = (output_tokens / 1000) * pricing['output']
        return pricing['provider'], pricing['model'], input_cost, output_cost
    
    return 'Unknown', 'Unknown', 0.0, 0.0        

def get_relevant_config(bucket_name, s3VideoObjectKey):
    try:
        return get_custom_config(extract_identity_from_path(s3VideoObjectKey), bucket_name), "CUSTOM"
    except Exception:
        try:
            return get_default_config(bucket_name), "DEFAULT"
        except Exception:
            raise ValueError("Cannot load default config")    

def get_custom_config(identity_id: str, bucket_name: str):
    """
    Load custom configuration from S3
    """
    try:
        config_key = f"config/{identity_id}/config.json"
        
        # Check if object exists first
        try:
            s3_client = boto3.client('s3')
            s3_client.head_object(Bucket=bucket_name, Key=config_key)
        except s3_client.exceptions.NoSuchKey:
            raise Exception(f"Custom config not found at {config_key}")
        
        # Download the config file
        response = s3_client.get_object(Bucket=bucket_name, Key=config_key)
        config_content = response['Body'].read().decode('utf-8')
        return json.loads(config_content)
        
    except Exception as e:
        print(f'Error loading custom configuration: {str(e)}')
        raise e

def get_default_config(bucket_name: str):
    """
    Load default configuration from S3 or hardcoded fallback
    """
    try:
        config_key = "config/default-config.json"
        
        # Try to download the default config file
        s3_client = boto3.client('s3')
        response = s3_client.get_object(Bucket=bucket_name, Key=config_key)
        config_content = response['Body'].read().decode('utf-8')
        return json.loads(config_content)
        
    except Exception as e:
        print(f'Error loading default configuration: {str(e)}')
        raise e
    
def frames_within_segment(segment, thumbnail_prefix, fps=1):
    start_index = int(segment['StartTimestampMillis'] / (1000 / fps)) + 1
    end_index = int(segment['EndTimestampMillis'] / (1000 / fps))

    if end_index < start_index:
        return []

    frames = []
    for i in range(start_index, end_index + 1):
        frames.append(f"{thumbnail_prefix}{i:07d}.jpg")

    return frames    

def extract_timestamp(frame, fps=1):
    filename = frame.split('/')[-1]
    timestamp_str = filename.split('.')[1].split('_')[0]
    timestamp = float(timestamp_str) / fps
    return timestamp

def get_output_prefix(s3_object_key, suffix):
    return s3_object_key.replace('assets/', 'processed/').replace('.mp4', '') + f"/{suffix}/"    

def get_chunk_prefix(s3_object_key):
    return get_output_prefix(s3_object_key, 'chunks')

def get_thumbnails_prefix(s3_object_key):
    return get_output_prefix(s3_object_key, 'thumbnails')

def get_analysis_prefix(s3_object_key):
    return get_output_prefix(s3_object_key, 'analysis')

def _index(str, want, i):
    if want in str[i:]:
        return str.index(want, i)
    return 999999

def fix_json(json_string):
    # check if json_bytes is bytes. If so, convert to string
    if isinstance(json_string, bytes):
        fixed = json_string.decode('utf-8')
    else:
        fixed = json_string
        
    try:
        json.loads(fixed)
    except Exception as e:
        print("BROKEN JSON. TRY FIXING")
        print(fixed)

        first_brace = fixed.index('{')
        last_brace = fixed.rindex('}')
        fixed = fixed[first_brace:last_brace + 1]

        fixed = fixed.replace('\\"', '"')
        
        # remove any trailing ,'s
        i=0
        buffer = ""
        for c in fixed:
            if c != ',':
                buffer += c
            else:
                # peek to see what comes next. If it is "[{ then output the comma. If it is ]} don't
                good = min([_index(fixed, '"', i), _index(fixed, '[', i), _index(fixed, '{', i)])
                bad = min([_index(fixed, ']', i), _index(fixed, '}', i)])
                if good < bad:
                    buffer += c
            
            i += 1
        fixed = buffer

        print("AFTER FIXING")
        print(fixed)

    return fixed

def load_json(text):
    return json.loads(fix_json(text))

def list_all_objects(bucket, prefix):
    s3_client = boto3.client('s3')
    objects = []
    continuation_token = None
    
    while True:
        if continuation_token:
            response = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix, ContinuationToken=continuation_token)
        else:
            response = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)
        
        if 'Contents' in response:
            objects.extend([obj['Key'] for obj in response['Contents']])
        
        if response.get('IsTruncated'):
            continuation_token = response['NextContinuationToken']
        else:
            break
    
    return objects

def load_s3_json_file(bucket, object, default=None):
    try:
        s3_client = boto3.client('s3')
        response = s3_client.get_object(Bucket=bucket, Key=object)
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except Exception as e:
        return default
    
def store_json_file(bucket, filename, data):
    boto3.client('s3').put_object(Bucket=bucket, Key=filename, Body=json.dumps(data))

def get_custom_house_categories_diff(identity_id: str, bucket_name: str):
    """
    Gets both default and custom config files and returns custom house categories
    that don't exist in the default config.
    
    Args:
        identity_id (str): User's identity ID for custom config
        bucket_name (str): S3 bucket name containing the configs
        
    Returns:
        list: Array of custom house categories not in default config
        
    Raises:
        Exception: If default config cannot be loaded
    """
    try:
        # Get default config (always exists)
        default_config = get_default_config(bucket_name)
        default_house_categories = default_config.get('houseCategories', [])
        
        custom_house_categories = []
        
        try:
            # Try to get custom config (may not exist)
            custom_config = get_custom_config(identity_id, bucket_name)
            custom_house_categories = custom_config.get('houseCategories', [])
        except Exception as e:
            # Custom config doesn't exist, return empty array
            print(f"Custom config not found for identity {identity_id}: {str(e)}")
            return []
        
        # Return items in custom config that don't exist in default config
        return [category for category in custom_house_categories 
                if category not in default_house_categories]
                
    except Exception as e:
        print(f"Error comparing house categories: {str(e)}")
        raise e    