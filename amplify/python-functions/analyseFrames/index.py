import json
import boto3
import time
from enum import Enum
import time
import commoncode
import base64
from datetime import datetime, timezone
from botocore.exceptions import ClientError

from botocore.config import Config

bedrock_client = boto3.client('bedrock-runtime', config = Config(
    connect_timeout=900,  # 15 minutes
    read_timeout=900,     # 15 minutes
    retries={'max_attempts': 1}
))

agent_runtime_client = boto3.client('bedrock-agent-runtime', config = Config(
    connect_timeout=900,  # 15 minutes
    read_timeout=900,     # 15 minutes
    retries={'max_attempts': 1}
))

s3_client = boto3.client('s3')
dynamodb = boto3.client('dynamodb')


def build_dynamic_prompt(custom_categories=None):
    """
    Build a dynamic prompt that includes custom house categories if they exist
    """
    base_categories = """
    - VIOLENCE : Clear violence, weapons being used aggressively, or graphic content (NOT objects that might be weapons or actions that might be violent or dangerous)
    - ADULT : Explicit nudity, sexual acts, or clearly inappropriate sexual content (NOT regular clothing or fashion)
    - HATE : Obvious hate speech symbols, offensive gestures, or discriminatory content
    - HARM : Clear self-harm indicators or dangerous behavior
    - DRUG : Visible drug use, drug paraphernalia, or obvious illegal substances (NOT prescription medications)
    - ALCOHOL : Clearly identifiable alcoholic beverages being consumed or prominently displayed with labels (beer bottles, wine bottles, liquor bottles, cocktails in bars). DO NOT flag coffee, tea, soft drinks, water, or other non-alcoholic beverages."""
    
    # Add custom categories if they exist
    custom_categories_text = ""
    if custom_categories and len(custom_categories) > 0:
        custom_categories_text = "\n\nAdditionally, check for these custom content categories:\n"
        for category in custom_categories:
            custom_categories_text += f"    - {category.upper().replace(' ', '_')} : Content related to {category}\n"
    
    prompt_text = f"""
You are an expert content moderator. Analyze the image for the following content moderation categories:{base_categories}
{custom_categories_text}

VISUAL TEXT ANALYSIS FOR PROFANITY CATEGORY:
Carefully scan the entire image for ANY visible profanity or suggestive language including:
- Text on signs, billboards, posters, and displays
- Writing on walls, buildings, or structures (graffiti, murals, painted text)
- Text on vehicles (cars, trucks, buses, license plates, bumper stickers, decals)
- Text on the ground or pavement (chalk, paint, markings)
- Text on clothing and accessories (t-shirts, hats, bags, jackets)
- Text on objects and surfaces (boxes, containers, papers, screens, books)
- Any other visible text in the scene
    
IMPORTANT DETECTION CRITERIA:
- ALCOHOL: Flag if you can clearly see alcoholic beverage labels, bottles with recognizable alcohol branding, obvious consumption of alcohol, OR drinks in clearly alcoholic contexts (e.g., glasses in bars, cocktails at parties, wine glasses at dinner, beer bottles/cans). Consider the setting and context - drinks in bars, restaurants are likely alcoholic. Do NOT flag generic containers and drinks in ambiguous settings. If it looks like water, assume it is water.
- ADULT: Only flag explicit nudity or sexual content and sexual acts. Intimate scenes or moments and close physical proximity should NOT be flagged as adult content. Regular clothing with exposed skin, dresses, swimwear, or fashion choices should NOT be flagged as adult content.
- VIOLENCE: Only flag actual weapons being used threateningly or clear violent acts. Do NOT flag objects being held that could potentially be weapons (like purses, phones, tools) unless there is clear threatening context.

Return results in JSON format.
You MUST answer in valid JSON format only. Only generate the JSON output. DO NOT provide any preamble. Follow the ##JSON_SCHEMA## below.
To fill in the JSON values, follow these ##JSON_GUIDELINES##:

##JSON_GUIDELINES##
Content Moderation Flags:
For each category detected from the list of categories above, add en entry with the following values:
    - "name" : provide the category from above. For example, if you see violence, use VIOLENCE
    - "detected" : true if the category is detected, false if not
    - "description" : provide a brief description of what was seen as relevant to the category
    - "confidence" : confidence score of the detection, 0-100, where 100 is the highest confidence

##JSON_SCHEMA##
{{
    "sections": [
        {{
          "name": "Content Moderation Flags",
          "subsections": [
            {{
              "name": "",
              "detected" : "",
              "description" : "",
              "confidence" : ""
            }}
        }}
    ]
}}
 
##JSON_SCHEMA##
"""
    
    return {"text": prompt_text}


class ProcessingType(Enum):
    VIDEO = "Video"
    AUDIO = "Audio"
    TRANSCRIPT = "Transcript"

def log_frame_analysis_inference_params(session_id: str, model_id: str, max_tokens: float, temperature: float, top_k: float, top_p: float):
    analysis_results_table = commoncode.get_parameters()['ANALYSIS_RESULTS_TABLE']        
    now = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')    

    expression = "ADD framesAnalysed :increment SET frameAnalysisBedrockModelId = :frameAnalysisBedrockModelId, frameAnalysisInferenceMaxTokens = :frameAnalysisInferenceMaxTokens, frameAnalysisInferenceTemperature = :frameAnalysisInferenceTemperature, frameAnalysisInferenceTopK = :frameAnalysisInferenceTopK, frameAnalysisInferenceTopP = :frameAnalysisInferenceTopP, updatedAt = :now"

    expression_values = {
       ':increment' : { 'N' : '1' },
       ':frameAnalysisBedrockModelId' : { 'S' : model_id },
       ':frameAnalysisInferenceMaxTokens' : { 'N' : str(max_tokens) },
       ':frameAnalysisInferenceTemperature' : { 'N' : str(temperature) },
       ':frameAnalysisInferenceTopK' : { 'N' : str(top_k) },
       ':frameAnalysisInferenceTopP' : { 'N' : str(top_p) },
       ':now' : { 'S' : now }
    }

    dynamodb.update_item(
        TableName=analysis_results_table,
        Key={'sessionId': {'S': session_id}},
        UpdateExpression=expression,
        ExpressionAttributeValues=expression_values
    )

def store_analysis_result(native_request, compliance_analysis, bucketName, frameKey):
    data = {
        'request' : native_request,
        'reponse' : compliance_analysis
    }

    key = frameKey.replace('.jpg', '_analysis.json').replace('thumbnails', 'thumbnails_analysis')
    print("storing result to - ", key)
    s3_client.put_object(Bucket=bucketName, Key=key, Body=json.dumps(data), ContentType='application/json')

def extract_frame_analysis_with_nova(bucketName, frameKey, config, s3VideoObjectKey, custom_categories=None):
    # Extract configuration values
    detailed_config = config.get('defaultDetailedReportConfig')
    inference_config = detailed_config.get('inferenceConfig')
    config_model_id = detailed_config.get('bedrockModelId')
    
    # Build dynamic prompt with custom categories
    prompt = build_dynamic_prompt(custom_categories)
        
    image_data = {
        "image": {
            "format": "jpg",
            "source": {
                "s3Location": {
                    "uri": f"s3://{bucketName}/{frameKey}"
                }
            }
        }
    }

    message_list = [{
        "role": "user",
        "content": [ image_data, prompt ]
    }]

    # Configure inference parameters
    inf_params = {
        "maxTokens": inference_config.get('maxTokens'),
        "topP":  inference_config.get('topP'),
        "topK": inference_config.get('topK'),
        "temperature": inference_config.get('temperature')
    }

    # Prepare the request
    native_request = {
        "schemaVersion": "messages-v1",
        "messages": message_list,
        "inferenceConfig": inf_params
    }

    # Use longer initial backoff for low-throughput models
    delay = 5 if 'nova-2-pro' in config_model_id.lower() else 1
    max_delay = 60
    while True:
        try:
            print("calling NOVA: ", config_model_id)

            start_time = time.time()
            
            response = bedrock_client.invoke_model(
                modelId=config_model_id,
                body=json.dumps(native_request)
            )

            processing_time = time.time() - start_time

            model_response = commoncode.load_json(response["body"].read())
            original = model_response['output']['message']['content'][0]['text']
            
            # try parsing the compliance_analysis json
            compliance_analysis = {}
            try:
                compliance_analysis = commoncode.load_json(original)
            except json.JSONDecodeError as e:
                # if the JSON was invalid, try to repair it using the agent
                commoncode.log_output_message(bucketName, s3VideoObjectKey, f"Agent: Repairing malformed JSON response", "Repair JSON")
                try:
                    repair_result_raw, repair_stats = invoke_json_repair_agent(bucketName, s3VideoObjectKey, original)
                    repair_result_json = json.loads(repair_result_raw)

                    compliance_analysis = repair_result_json.get('repairedJson', repair_result_json)
                    
                    # double check that the repaired json is now valid
                    try:
                        if isinstance(compliance_analysis, str):
                            compliance_analysis = json.loads(compliance_analysis)
                    except json.JSONDecodeError:
                        commoncode.log_output_message(bucketName, s3VideoObjectKey, f"Error repairing JSON.", "error")
                        raise
                    
                    print("JSON repair successful.")
                except ClientError as e:
                    commoncode.log_output_message(bucketName, s3VideoObjectKey, f"Error repairing JSON.", "error")
                    raise

            # Extract usage information
            usage = model_response.get('usage', {})
            input_tokens = usage.get('inputTokens', 0)
            output_tokens = usage.get('outputTokens', 0)

            # Calculate costs and get provider
            model_provider, model, input_token_cost, output_token_cost = commoncode.calculate_model_cost(config_model_id, input_tokens, output_tokens)

            # Save statistics
            commoncode.save_statistics(
                session_id=commoncode.extract_session_from_object(bucketName, s3VideoObjectKey),
                identity_id=commoncode.extract_identity_from_path(s3VideoObjectKey),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                input_token_cost=input_token_cost,
                output_token_cost=output_token_cost,
                model_id=config_model_id,
                model=model,
                processing_time=processing_time,
                model_provider=model_provider,
                processing_type="Frame",
                content_type='Image',
                duration=0
            )

            log_frame_analysis_inference_params(
                commoncode.extract_session_from_object(bucketName, s3VideoObjectKey),
                config_model_id,
                inference_config.get('maxTokens'),
                inference_config.get('temperature'),
                inference_config.get('topK'),
                inference_config.get('topP')
            )
        
            return store_analysis_result(native_request, compliance_analysis, bucketName, frameKey)
        except (bedrock_client.exceptions.ThrottlingException, bedrock_client.exceptions.ServiceUnavailableException):
            print(f"Throttling or service unavailable detected, retrying in {delay} seconds")
            time.sleep(delay)
            delay = min(delay * 2, max_delay)

def extract_frame_analysis_with_anthropic(bucketName, frameKey, config, s3VideoObjectKey, custom_categories=None):
    # Extract configuration values
    detailed_config = config.get('defaultDetailedReportConfig')
    inference_config = detailed_config.get('inferenceConfig')
    config_model_id = detailed_config.get('bedrockModelId')

    # Build dynamic prompt with custom categories
    prompt = build_dynamic_prompt(custom_categories)

    # Get image from S3
    response = s3_client.get_object(Bucket=bucketName, Key=frameKey)
    image_data = response['Body'].read()
    image_base64 = base64.b64encode(image_data).decode('utf-8')
    
    image_data = {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": "image/jpeg",
            "data": image_base64
        }
    }

    message_list = [{
        "role": "user",
        "content": [ 
            image_data, 
            { "type" : "text", "text" : prompt['text'] } 
        ]
    }]

    # Prepare the request
    native_request = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": inference_config.get('maxTokens'),
        "top_k": inference_config.get('topK'),
        "messages": message_list
    }

    # Models that have deprecated the temperature parameter (Bedrock rejects it)
    temperature_excluded_models = ['anthropic.claude-opus-4-7', 'anthropic.claude-opus-4-8']
    if not any(excluded in config_model_id.lower() for excluded in temperature_excluded_models):
        native_request["temperature"] = inference_config.get('temperature')

    # Models that don't support simultaneous temperature + top_p
    top_p_excluded_models = ['anthropic.claude-sonnet-4-5', 'anthropic.claude-sonnet-4-6', 'anthropic.claude-opus-4-6']
    if not any(excluded in config_model_id.lower() for excluded in top_p_excluded_models):
        native_request["top_p"] = inference_config.get('topP')

    # Use longer initial backoff for low-throughput models
    delay = 5 if 'nova-2-pro' in config_model_id.lower() else 1
    max_delay = 60
    while True:
        try:
            print("calling ", config_model_id)
            
            # Measure processing time
            start_time = time.time()

            response = bedrock_client.invoke_model(
                modelId=config_model_id,
                body=json.dumps(native_request)
            )
            
            processing_time = time.time() - start_time

            model_response = commoncode.load_json(response["body"].read())
            text = model_response['content'][0]['text']
            
            # try parsing the compliance_analysis json
            compliance_analysis = {}
            try:
                compliance_analysis = commoncode.load_json(text)
            except json.JSONDecodeError as e:
                # if the JSON was invalid, try to repair it using the agent
                commoncode.log_output_message(bucketName, s3VideoObjectKey, f"Agent: Repairing malformed JSON response", "Repair JSON")
                try:
                    repair_result_raw, repair_stats = invoke_json_repair_agent(bucketName, s3VideoObjectKey, text)
                    repair_result_json = json.loads(repair_result_raw)

                    compliance_analysis = repair_result_json.get('repairedJson', repair_result_json)
                    
                    # double check that the repaired json is now valid
                    try:
                        if isinstance(compliance_analysis, str):
                            compliance_analysis = json.loads(compliance_analysis)
                    except json.JSONDecodeError:
                        commoncode.log_output_message(bucketName, s3VideoObjectKey, f"Error repairing JSON.", "error")
                        raise
                    
                    print("JSON repair successful.")
                except ClientError as e:
                    commoncode.log_output_message(bucketName, s3VideoObjectKey, f"Error repairing JSON.", "error")
                    raise

            # Extract usage information
            usage = model_response.get('usage', {})
            input_tokens = usage.get('input_tokens', 0)
            output_tokens = usage.get('output_tokens', 0)

            # Calculate costs and get provider
            model_provider, model, input_token_cost, output_token_cost = commoncode.calculate_model_cost(config_model_id, input_tokens, output_tokens)

            # Save statistics
            commoncode.save_statistics(
                session_id=commoncode.extract_session_from_object(bucketName, s3VideoObjectKey),
                identity_id=commoncode.extract_identity_from_path(s3VideoObjectKey),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                input_token_cost=input_token_cost,
                output_token_cost=output_token_cost,
                model_id=config_model_id,
                model=model,
                processing_time=processing_time,
                model_provider=model_provider,
                processing_type="Frame",
                content_type='Image',
                duration=0
            )

            log_frame_analysis_inference_params(
                commoncode.extract_session_from_object(bucketName, s3VideoObjectKey),
                config_model_id,
                inference_config.get('maxTokens'),
                inference_config.get('temperature'),
                inference_config.get('topK'),
                inference_config.get('topP')
            )

            return store_analysis_result(native_request, compliance_analysis, bucketName, frameKey)
        except (bedrock_client.exceptions.ThrottlingException, bedrock_client.exceptions.ServiceUnavailableException):
            print(f"Throttling or service unavailable detected, retrying in {delay} seconds")
            time.sleep(delay)
            delay = min(delay * 2, max_delay)


def lambda_handler(event, context):
    try:
        bucket_name = event.get('bucketName')
        s3VideoObjectKey = event.get('s3VideoObjectKey')
        thumbnail = event.get('thumbnail')

        config, config_type = commoncode.get_relevant_config(bucket_name, s3VideoObjectKey)

        # Get custom house categories that don't exist in default config
        identity_id = commoncode.extract_identity_from_path(s3VideoObjectKey)
        custom_categories = commoncode.get_custom_house_categories_diff(identity_id, bucket_name)
        
        if custom_categories:
            print(f"Found {len(custom_categories)} custom house categories: {custom_categories}")

        # this lambda is invoked once per frame - carefully provide output once
        if '.0000000.jpg' in thumbnail:
            commoncode.log_output_message(bucket_name, s3VideoObjectKey, f"Analyzing frame-level for compliance.", "Analyze Frames")        
        
        print('process: ', bucket_name, thumbnail)

        model_id = config['defaultDetailedReportConfig']['bedrockModelId']
        if 'nova' in model_id:
            extract_frame_analysis_with_nova(bucket_name, thumbnail, config, s3VideoObjectKey, custom_categories)
        elif 'anthropic' in model_id:
            extract_frame_analysis_with_anthropic(bucket_name, thumbnail, config, s3VideoObjectKey, custom_categories)
        else:
            raise(f"Unknown model being requested: {model_id}")

        return {}
    
    except Exception as e:
        print(f"Error: {e}")
        commoncode.log_output_message(bucket_name, s3VideoObjectKey, str(e), "error")
        raise e

def invoke_json_repair_agent(bucket, s3_object_video_key, invalidJSON):
    """
    Repair malformed JSON using the repair JSON agent
    """
    print("Invoking JSON repair")
    session_id = commoncode.extract_session_from_object(bucket, s3_object_video_key)
    identity_id = commoncode.extract_identity_from_path(s3_object_video_key)

    params = commoncode.get_parameters()
    agent_id = params['REPAIR_JSON_AGENT_ID']
    agent_alias_id = params['REPAIR_JSON_AGENT_ALIAS_ID']

    prompt = f"""Repair the following malformed JSON. It is CRITICAL that you DO NOT start the response with ```json. Double check to make sure the response you return is valid JSON: 
    ###JSON TO REPAIR###
    {invalidJSON}
    ###JSON TO REPAIR###
    """

    response = agent_runtime_client.invoke_agent(
        agentId=agent_id,
        agentAliasId=agent_alias_id,
        enableTrace=True, # leave this enabled to calculate input/output token cost
        sessionId = session_id,
        inputText=prompt
    )

    metrics = {'inputTokens': 0, 'outputTokens': 0, 'totalTimeMs': 0}

    print(response)

    completion = ""
    for event in response.get("completion"):
        # Collect agent output
        if 'chunk' in event:
            chunk = event["chunk"]
            completion += chunk["bytes"].decode()
        
        # Log trace output
        if 'trace' in event:
            trace_event = event.get("trace")
            trace = trace_event['trace']
            for key, value in trace.items():
                print(f"{key}: {value}")
                if key == 'orchestrationTrace':
                    if 'modelInvocationOutput' in value:
                        metadata = value['modelInvocationOutput']['metadata']
                        usage = metadata.get('usage', {})
                        metrics['inputTokens'] += usage.get('inputTokens', 0)
                        metrics['outputTokens'] += usage.get('outputTokens', 0)
                        metrics['totalTimeMs'] += metadata.get('totalTimeMs', 0)
                    if 'modelInvocationInput' in value and 'modelId' not in metrics:
                        foundation_model = value['modelInvocationInput'].get('foundationModel', '')
                        model_id = foundation_model if foundation_model.startswith('us.') else f'us.{foundation_model}'
                        metrics['modelId'] = model_id

    print(f"JSON repair agent response: {completion}")

    # Save statistics for json repair agent
    json_repair_model_provider, json_repair_model, json_repair_input_token_cost, json_repair_output_token_cost = commoncode.calculate_model_cost(metrics['modelId'], metrics['inputTokens'], metrics['outputTokens'])
    commoncode.save_statistics(
        session_id=session_id,
        identity_id=identity_id,
        input_tokens=metrics['inputTokens'],
        output_tokens=metrics['outputTokens'],
        input_token_cost=json_repair_input_token_cost,
        output_token_cost=json_repair_output_token_cost,
        model_id=metrics['modelId'],
        model=json_repair_model,
        processing_time=metrics['totalTimeMs'] / 1000,
        model_provider=json_repair_model_provider,
        processing_type="Agent",
        content_type="JSON Repair",
        duration=0.0
    )

    return completion, metrics
