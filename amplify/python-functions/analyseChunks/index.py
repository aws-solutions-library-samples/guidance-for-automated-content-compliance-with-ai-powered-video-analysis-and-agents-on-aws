import json
import boto3
import time
import re
from datetime import datetime, timezone
import commoncode
from botocore.config import Config
from botocore.exceptions import ClientError

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

def update_analysis_results(session_id: str, usage_output_tokens: int, usage_input_tokens: int):
    analysis_results_table = commoncode.get_parameters()['ANALYSIS_RESULTS_TABLE']        
    now = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')    

    expression = "ADD usageInputTokens :usageInputTokens, usageOutputTokens :usageOutputTokens SET updatedAt = :now"

    expression_values = {
       ':usageInputTokens' : { 'N' : str(usage_input_tokens) },
       ':usageOutputTokens' : { 'N' : str(usage_output_tokens) },
       ':now' : { 'S' : now }
    }

    dynamodb.update_item(
        TableName=analysis_results_table,
        Key={'sessionId': {'S': session_id}},
        UpdateExpression=expression,
        ExpressionAttributeValues=expression_values
    )


def set_analysis_results(bucket: str, s3_video_key: str, model_id: str, prompt: str, system_prompt: str,
                         max_tokens: int, temperature: float, top_p: float, top_k: float, usage_output_tokens: int, usage_input_tokens: int,
                         stop_reason: str, result_raw: str, result_json: dict, frame_analysis_FPS: int):

    analysis_results_table = commoncode.get_parameters()['ANALYSIS_RESULTS_TABLE']
    now = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

    # Get transcript key if available (not needed for Twelve Labs models)
    transcript_key = ''
    try:
        transcript_key = commoncode.get_tag_value(bucket, s3_video_key, 'TranscriptS3Key')
    except:
        # Transcript not available (e.g., for Twelve Labs Pegasus model)
        pass

    # Get Mimir item ID if available (set by mimirActionHandler)
    mimir_item_id = commoncode.get_tag_value(bucket, s3_video_key, 'MimirItemId', should_exception=False)

    # Use update_item instead of put_item to avoid overwriting fields set by
    # parallel steps (e.g. totalFrames, framesToAnalyse, framesAnalysed)
    session_id = commoncode.extract_session_from_object(bucket, s3_video_key)

    set_parts = [
        "identityId = :identityId",
        "s3VideoObjectKey = :s3VideoObjectKey",
        "s3TranscriptObjectKey = :s3TranscriptObjectKey",
        "s3OriginalFilename = :s3OriginalFilename",
        "bedrockModelId = :bedrockModelId",
        "prompt = :prompt",
        "resultRaw = :resultRaw",
        "contentType = :contentType",
        "frameAnalysisFPS = :frameAnalysisFPS",
        "createdAt = if_not_exists(createdAt, :now)",
        "updatedAt = :now"
    ]

    expression_values = {
        ':identityId': {'S': commoncode.extract_identity_from_path(s3_video_key)},
        ':s3VideoObjectKey': {'S': s3_video_key},
        ':s3TranscriptObjectKey': {'S': transcript_key},
        ':s3OriginalFilename': {'S': commoncode.get_tag_value(bucket, s3_video_key, 'OriginalFilename')},
        ':bedrockModelId': {'S': model_id},
        ':prompt': {'S': prompt},
        ':resultRaw': {'S': result_raw},
        ':contentType': {'S': commoncode.get_tag_value(bucket, s3_video_key, 'ContentType')},
        ':frameAnalysisFPS': {'N': str(frame_analysis_FPS)},
        ':now': {'S': now},
        ':usageOutputTokens': {'N': str(usage_output_tokens)},
        ':usageInputTokens': {'N': str(usage_input_tokens)}
    }

    if system_prompt:
        set_parts.append("systemPrompt = :systemPrompt")
        expression_values[':systemPrompt'] = {'S': system_prompt}
    if max_tokens:
        set_parts.append("inferenceMaxTokens = :inferenceMaxTokens")
        expression_values[':inferenceMaxTokens'] = {'N': str(max_tokens)}
    if top_p:
        set_parts.append("inferenceTopP = :inferenceTopP")
        expression_values[':inferenceTopP'] = {'N': str(top_p)}
    if top_k:
        set_parts.append("inferenceTopK = :inferenceTopK")
        expression_values[':inferenceTopK'] = {'N': str(top_k)}
    if temperature is not None:
        set_parts.append("inferenceTemperature = :inferenceTemperature")
        expression_values[':inferenceTemperature'] = {'N': str(temperature)}
    if stop_reason:
        set_parts.append("stopReason = :stopReason")
        expression_values[':stopReason'] = {'S': stop_reason}
    if result_json:
        set_parts.append("resultJSON = :resultJSON")
        expression_values[':resultJSON'] = {'S': json.dumps(result_json)}

    if mimir_item_id:
        set_parts.append("mimirItemId = :mimirItemId")
        expression_values[':mimirItemId'] = {'S': mimir_item_id}

    # Use ADD for token counts so concurrent updates don't lose increments
    add_parts = [
        "usageOutputTokens :usageOutputTokens",
        "usageInputTokens :usageInputTokens"
    ]

    expression = f"SET {', '.join(set_parts)} ADD {', '.join(add_parts)}"

    dynamodb.update_item(
        TableName=analysis_results_table,
        Key={'sessionId': {'S': session_id}},
        UpdateExpression=expression,
        ExpressionAttributeValues=expression_values
    )
    print(f'Successfully saved analysis results to {analysis_results_table}')


def send_to_pegasus(bucket_name, s3_object_key, video_chunk, config, chunk_count):
  session_id = commoncode.extract_session_from_object(bucket_name, s3_object_key)
  identity_id = commoncode.extract_identity_from_path(s3_object_key)
  content_type = commoncode.get_tag_value(bucket_name, s3_object_key, 'ContentType')

  general_config = config.get('defaultGeneralReportConfig')
  inference_config = general_config.get('inferenceConfig')
  config_model_id = general_config.get('bedrockModelId')
  houseRatings = config.get('houseCategories')
  fpsByContentType = config.get("defaultFramesPerSecond").get(content_type)

  print(f"Sending {video_chunk} to {config_model_id}")

  max_tokens = inference_config.get('maxTokens')
  temperature = inference_config.get('temperature')
  
  # Create the prompt for Twelve Labs Pegasus
  input_prompt = f"""
Perform a comprehensive content rating analysis of this video. Consider both the visual content and the audio.
You MUST answer in valid JSON format only. Only generate the JSON output. DO NOT provide any preamble, such as ```json. Follow the ##JSON_SCHEMA## below.
To fill in the JSON values, follow these ##JSON_GUIDELINES##:

##JSON_GUIDELINES##
General Rating System Analysis:
- ##Suggested Rating##: "Adult 18+", "Teen 13+", "Child 7+", or "All Ages"
- ##Justification##: detailed justification for this specific rating
- ##Elements##: comma-separated list of elements contributing to the rating, such as "mild violence", "strong language"

House Rating System Analysis:
- Check if ##HOUSE_FLAGS## are detected in the content: {', '.join([f'"{rating}"' for rating in houseRatings])}
- There should be a JSON entry for each of the ##HOUSE_FLAGS## items that are detected to be true in the content. Do not add an entry for flags that are not detected.
- If a ##HOUSE_FLAG## is detected, add a topics object for Description (detailed description of what is observed) and Severity (mild, moderate, severe) for that specific ##HOUSE_FLAG##

Content Moderation Analysis:
- Check if the ##MODERATION_FLAGS## are detected in the content: "Violence", "Adult Content", "Hate Speech", "Self Harm", "Profanity", "Drug Reference", "Alcohol Reference"
- There should be a JSON entry for each of the ##MODERATION_FLAGS## items that are detected to be true in the content. Do not add an entry for flags that are not detected.
- If a ##MODERATION_FLAGS## is detected, add a topics object for Description (detailed description of what is observed, including exact dialogue for profanity and hate speech if applicable) and Severity (mild, moderate, severe) for that specific ##MODERATION_FLAG##

Other Analysis:
- For each of these ##OTHER_FLAGS##, provide an assessment or brief summary: "Theme and Messaging", "Visual Content Assessment", "Transcript", "Profanity", "Target Audience", "Sensitive Content Areas"
- There should be a JSON entry for each of the ##OTHER_FLAGS## items that are detected to be true in the content. Do not add an entry for flags that are not detected.
- If a ##OTHER_FLAGS## is detected, add a topics object for Description (detailed description of what is observed, including exact dialogue for profanity and hate speech if applicable) and Severity (mild, moderate, severe) for that specific ##OTHER_FLAG##

Brands and Logos:
- Check if any brand names or logos are detected in the content.
- There should be a JSON entry for each of the brand names or logos that are detected in the section ##BRAND_NAMES##.
- If a ##BRAND_NAME## is detected, add a topics object for Placement (where does the brand or logo appear in the image) and Prominence (low, medium, high) for that specific ##BRAND_NAME##

##JSON_GUIDELINES##

##JSON_SCHEMA##
{{
    "sections": [
        {{
          "name": "General Rating System",
          "subsections": [
            {{
              "name": "Suggested Rating",
              "value": ""
            }},
            {{
              "name": "Justification",
              "value": ""
            }},
            {{
              "name": "Elements",
              "value": ""
            }}
          ]
        }},
        {{
          "name": "House Rating System",
          "subsections": [
            {{
              "name": "##HOUSE_FLAGS##",
              "topics": [
                {{
                    "name": "Description",
                    "value": ""
                }},
                {{
                    "name": "Severity",
                    "value": ""
                }}
              ]
            }}
          ]
        }},
        {{
          "name": "Content Moderation",
          "subsections": [
            {{
              "name": "##MODERATION_FLAGS##",
              "topics": [
                {{
                    "name": "Description",
                    "value": ""
                }},
                {{
                    "name": "Severity",
                    "value": ""
                }}
              ]
            }}
          ]
        }},
        {{
          "name": "Other",
          "subsections": [
            {{
              "name": "##OTHER_FLAGS##",
              "topics": [
                {{
                    "name": "Description",
                    "value": ""
                }},
                {{
                    "name": "Severity",
                    "value": ""
                }}
              ]
            }}
          ]
        }},
        {{
          "name": "Brands and Logos",
          "subsections": [
            {{
              "name": "##BRAND_NAMES##",
              "topics": [
                {{
                    "name": "Placement",
                    "value": ""
                }},
                {{
                    "name": "Prominence",
                    "value": ""
                }}
              ]
            }}
          ]
        }}
    ]
}}
##JSON_SCHEMA##
"""
  
  # Twelve Labs Pegasus request format
  request_body = {
      "inputPrompt": input_prompt,
      "temperature": temperature,
      "mediaSource": {
          "s3Location": {
              "uri": f"s3://{bucket_name}/{video_chunk}",
              "bucketOwner": boto3.client('sts').get_caller_identity()['Account']
          }
      },
      "maxOutputTokens": max_tokens
  }
  
  commoncode.log_output_message(bucket_name, s3_object_key, f"Analyzing video-level for compliance", "Analyze Video")

  processing_time = 0
  delay = 1

  # Measure processing time
  while processing_time == 0:
      try:
          start_time = time.time()

          response = bedrock_client.invoke_model(
              modelId=config_model_id,
              body=json.dumps(request_body),
              contentType="application/json"
          )
          processing_time = time.time() - start_time
      except (bedrock_client.exceptions.ThrottlingException,
              bedrock_client.exceptions.ServiceUnavailableException) as e:
          print(f"Throttling/service unavailable detected ({type(e).__name__}), retrying in {delay * 60} seconds")
          if delay > 3:
              commoncode.log_output_message(bucket_name, s3_object_key, f"Persistent Throttling detected when analysing chunks using {config_model_id}", "warning")
              return None
          
          time.sleep(60 * delay)
          delay += 1           
  
  # Parse the response for Twelve Labs format
  response_body = response['body'].read()  
  response_body = commoncode.load_json(response_body)
  compliance_analysis = response_body['message']

  # try parsing the compliance_analysis json
  compliance_analysis_valid_json = {}
  try:
    compliance_analysis_valid_json = commoncode.load_json(compliance_analysis)
  except json.JSONDecodeError as e:
    # if the JSON was invalid, try to repair it using the agent
    commoncode.log_output_message(bucket_name, s3_object_key, f"Agent: Repairing malformed JSON response", "Repair JSON")
    try:
      repair_result_raw, repair_stats = invoke_json_repair_agent(bucket_name, s3_object_key, compliance_analysis)
      repair_result_json = json.loads(repair_result_raw)

      compliance_analysis_valid_json = repair_result_json.get('repairedJson', repair_result_json)
      
      # double check that the repaired json is now valid
      try:
        if isinstance(compliance_analysis_valid_json, str):
          compliance_analysis_valid_json = json.loads(compliance_analysis_valid_json)
      except json.JSONDecodeError:
        commoncode.log_output_message(bucket_name, s3_object_key, f"Error repairing JSON.", "error")
        raise
      
      print("JSON repair successful.")
    except ClientError as e:
      commoncode.log_output_message(bucket_name, s3_object_key, f"Error repairing JSON.", "error")
      raise

  # Extract usage information for Twelve Labs format
  usage = response_body.get('usage', {})
  input_tokens = usage.get('inputTokens', 0)
  output_tokens = usage.get('outputTokens', 0)
  stop_reason = response_body.get('finishReason', '')

  if stop_reason == 'length':
      commoncode.log_output_message(bucket_name, s3_object_key, f"Max tokens reached. Output may be incomplete. Increase the max tokens and try again.", "error")
      return None

  compliance_analysis_key = video_chunk.replace('.mp4', '_analysis.json')
  compliance_analysis_valid_json_string = json.dumps(compliance_analysis_valid_json)
  s3_client.put_object(Bucket=bucket_name, Key=compliance_analysis_key, Body=compliance_analysis_valid_json_string)

  if chunk_count == 0:
    set_analysis_results(
        bucket=bucket_name,
        s3_video_key=s3_object_key,
        model_id=config_model_id,
        prompt=input_prompt,
        system_prompt=None,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=None,
        top_k=None,
        usage_output_tokens=output_tokens,
        usage_input_tokens=input_tokens,
        stop_reason=stop_reason,
        result_raw=compliance_analysis_valid_json_string,
        result_json=compliance_analysis_valid_json,
        frame_analysis_FPS=fpsByContentType
    )
  else:
    update_analysis_results(
      session_id=session_id,
      usage_output_tokens=output_tokens,
      usage_input_tokens=input_tokens
    )
  
  # Get chunk duration for Pegasus model cost calculation
  chunk_duration = float(commoncode.get_tag_value(bucket_name, s3_object_key, 'DurationSeconds'))
  
  # Calculate costs and get provider
  model_provider, model, input_token_cost, output_token_cost = commoncode.calculate_model_cost(config_model_id, input_tokens, output_tokens, chunk_duration)
  
  # Save statistics
  commoncode.save_statistics(
    session_id=session_id,
    identity_id=identity_id,
    input_tokens=input_tokens,
    output_tokens=output_tokens,
    input_token_cost=input_token_cost,
    output_token_cost=output_token_cost,
    model_id=config_model_id,
    model=model,
    processing_time=processing_time,
    model_provider=model_provider,
    processing_type="Video",
    content_type=content_type,
    duration=chunk_duration
  )

  return compliance_analysis_valid_json

def send_to_nova(bucket_name, s3_object_key, video_chunk, transcript_chunk, config, chunk_count):
  session_id = commoncode.extract_session_from_object(bucket_name, s3_object_key)
  identity_id = commoncode.extract_identity_from_path(s3_object_key)
  content_type = commoncode.get_tag_value(bucket_name, s3_object_key, 'ContentType')

  general_config = config.get('defaultGeneralReportConfig')
  inference_config = general_config.get('inferenceConfig')
  config_model_id = general_config.get('bedrockModelId')
  houseRatings = config.get('houseCategories')
  fpsByContentType = config.get("defaultFramesPerSecond").get(content_type)

  print(f"Sending {video_chunk} to {config_model_id}")

  max_tokens = inference_config.get('maxTokens')
  temperature = inference_config.get('temperature')
  top_p = inference_config.get('topP')
  top_k = inference_config.get('topK')
  
  transcript_content = s3_client.get_object(Bucket=bucket_name, Key=transcript_chunk)['Body'].read().decode('utf-8')

  # Create the message content
  message_content = [
      {
          "video": {
              "format": "mp4", 
              "source": {
                  "s3Location": {
                      "uri": f"s3://{bucket_name}/{video_chunk}"
                  }
              }
          }
      },
      {
          "text": f"""
Perform a comprehensive content rating analysis of this video. Consider both the visual content and the ##TRANSCRIPT##.
You MUST answer in valid JSON format only. Only generate the JSON output. DO NOT provide any preamble, such as ```json. Follow the ##JSON_SCHEMA## below.
To fill in the JSON values, follow these ##JSON_GUIDELINES##:

##JSON_GUIDELINES##
General Rating System Analysis:
- ##Suggested Rating##: "Adult 18+", "Teen 13+", "Child 7+", or "All Ages"
- ##Justification##: detailed justification for this specific rating
- ##Elements##: comma-separated list of elements contributing to the rating, such as "mild violence", "strong language"

House Rating System Analysis:
- Check if ##HOUSE_FLAGS## are detected in the content: {', '.join([f'"{rating}"' for rating in houseRatings])}
- There should be a JSON entry for each of the ##HOUSE_FLAGS## items that are detected to be true in the content. Do not add an entry for flags that are not detected.
- If a ##HOUSE_FLAG## is detected, add a topics object for Description (detailed description of what is observed) and Severity (mild, moderate, severe) for that specific ##HOUSE_FLAG##

Content Moderation Analysis:
- Check if the ##MODERATION_FLAGS## are detected in the content: "Violence", "Adult Content", "Hate Speech", "Self Harm", "Profanity", "Drug Reference", "Alcohol Reference"
- There should be a JSON entry for each of the ##MODERATION_FLAGS## items that are detected to be true in the content. Do not add an entry for flags that are not detected.
- If a ##MODERATION_FLAGS## is detected, add a topics object for Description (detailed description of what is observed, including exact dialogue for profanity and hate speech if applicable) and Severity (mild, moderate, severe) for that specific ##MODERATION_FLAG##

Other Analysis:
- For each of these ##OTHER_FLAGS##, provide an assessment or brief summary: "Theme and Messaging", "Visual Content Assessment", "Transcript", "Profanity", "Target Audience", "Sensitive Content Areas"
- There should be a JSON entry for each of the ##OTHER_FLAGS## items that are detected to be true in the content. Do not add an entry for flags that are not detected.
- If a ##OTHER_FLAGS## is detected, add JSON topics keys/values for "Description" (detailed description of what is observed, including exact dialogue for profanity and hate speech if applicable) and "Severity" (mild, moderate, severe, for how severe the flag is) for that specific ##OTHER_FLAG##
- If a ##OTHER_FLAGS## is NOT detected, do not include JSON topics keys/values for "Description" and "Severity"
- Follow the ##JSON_SCHEMA## below for ##OTHER_FLAG##

Brands and Logos:
- Check if any brand names or logos are detected in the content. If there are no brands/logos, do not include the ##BRAND_NAME## json entry
- There should be a JSON entry for each of the brand names or logos that are detected in the section ##BRAND_NAMES##.
- If a ##BRAND_NAME## is detected, add JSON topics keys/values for "Placement" (where does the brand or logo appear) and "Prominence" (low, medium, high, for how visible it is) for that specific ##BRAND_NAME##
- If a ##BRAND_NAME## is NOT detected, do NOT include JSON topics keys/values for "Placement" and "Prominence"
- Follow the ##JSON_SCHEMA## below for ##BRAND_NAME##

##TRANSCRIPT##:
{transcript_content}
##TRANSCRIPT##

##JSON_GUIDELINES##

##JSON_SCHEMA##
{{
    "sections": [
        {{
          "name": "General Rating System",
          "subsections": [
            {{
              "name": "Suggested Rating",
              "value": ""
            }},
            {{
              "name": "Justification",
              "value": ""
            }},
            {{
              "name": "Elements",
              "value": ""
            }}
          ]
        }},
        {{
          "name": "House Rating System",
          "subsections": [
            {{
              "name": "##HOUSE_FLAG##",
              "topics": [
                {{
                    "name": "Description",
                    "value": ""
                }},
                {{
                    "name": "Severity",
                    "value": ""
                }}
              ]
            }}
          ]
        }},
        {{
          "name": "Content Moderation",
          "subsections": [
            {{
              "name": "##MODERATION_FLAG##",
              "topics": [
                {{
                    "name": "Description",
                    "value": ""
                }},
                {{
                    "name": "Severity",
                    "value": ""
                }}
              ]
            }}
          ]
        }},
        {{
          "name": "Other",
          "subsections": [
            {{
              "name": "##OTHER_FLAG##",
              "topics": [
                {{
                    "name": "Description",
                    "value": ""
                }},
                {{
                    "name": "Severity",
                    "value": ""
                }}
              ]
            }}
          ]
        }},
        {{
          "name": "Brands and Logos",
          "subsections": [
            {{
              "name": "##BRAND_NAME##",
              "topics": [
                {{
                    "name": "Placement",
                    "value": ""
                }},
                {{
                    "name": "Prominence",
                    "value": ""
                }}
              ]
            }}
          ]
        }}
    ]
}}
##JSON_SCHEMA##
"""
      }
  ]
  
  system_prompt = "You are an expert content compliance analyst specializing in media content evaluation. Your role is to analyze video content and transcripts for compliance with various rating systems and content policies. Provide thorough, accurate assessments following the specified JSON schema format. Focus on identifying specific content elements, their severity levels, and appropriate ratings based on industry standards."
  
  request_body = {
      "system": [
          {
          "text": system_prompt
          }
      ],
      "messages": [
          {
              "role": "user",
              "content": message_content
          }
      ],
      "inferenceConfig": {
          "maxTokens": max_tokens,
          "temperature": temperature,
          "topP": top_p,
          "topK": top_k
      }
  }
  
  commoncode.log_output_message(bucket_name, s3_object_key, f"Analyzing video-level for compliance", "Analyze Video")

  processing_time = 0
  delay = 1

  # Measure processing time
  while processing_time == 0:
      try:
          start_time = time.time()

          response = bedrock_client.invoke_model(
              modelId=config_model_id,
              body=json.dumps(request_body),
              contentType="application/json"
          )
          processing_time = time.time() - start_time
      except (bedrock_client.exceptions.ThrottlingException,
              bedrock_client.exceptions.ServiceUnavailableException) as e:
          print(f"Throttling/service unavailable detected ({type(e).__name__}), retrying in {delay * 60} seconds")
          if delay > 3:
              commoncode.log_output_message(bucket_name, s3_object_key, f"Persistent Throttling detected when analysing chunks using {config_model_id}", "warning")
              # we don't want the lambda timing out and killing the whole process. We have waited 6 mins already!
              return None
          
          time.sleep(60 * delay)
          delay += 1           
  
  # Parse the response
  response_body = response['body'].read()  
  response_body = commoncode.load_json(response_body)
  compliance_analysis = response_body['output']['message']['content'][0]['text']

  # try parsing the compliance_analysis json
  compliance_analysis_valid_json = {}
  try:
    compliance_analysis_valid_json = commoncode.load_json(compliance_analysis)
  except json.JSONDecodeError as e:
    # if the JSON was invalid, try to repair it using the agent
    commoncode.log_output_message(bucket_name, s3_object_key, f"Agent: Repairing malformed JSON response", "Repair JSON")
    try:
      repair_result_raw, repair_stats = invoke_json_repair_agent(bucket_name, s3_object_key, compliance_analysis)
      repair_result_json = json.loads(repair_result_raw)

      compliance_analysis_valid_json = repair_result_json.get('repairedJson', repair_result_json)
      print('Repair results:')
      print(compliance_analysis_valid_json)
      print(repair_result_json)
      
      # double check that the repaired json is now valid
      try:
        # if the response is str, convert it to json object
        if isinstance(compliance_analysis_valid_json, str):
          compliance_analysis_valid_json = json.loads(compliance_analysis_valid_json)
        # if it's already a dict, it's valid JSON
      except json.JSONDecodeError:
        commoncode.log_output_message(bucket_name, s3_object_key, f"Error repairing JSON.", "error")
        print(f"Client error1: {str(e)}")
        raise
      
      print("JSON repair successful.")
    except ClientError as e:
      commoncode.log_output_message(bucket_name, s3_object_key, f"Error repairing JSON.", "error")
      print(f"Client error2: {str(e)}")
      raise

  # Extract usage information
  usage = response_body.get('usage', {})
  input_tokens = usage.get('inputTokens', 0)
  output_tokens = usage.get('outputTokens', 0)
  stop_reason = response_body.get('stopReason', '')

  if stop_reason == 'max_tokens':
      commoncode.log_output_message(bucket_name, s3_object_key, f"Max tokens reached. Output may be incomplete. Increase the max tokens and try again.", "error")
      return None

  compliance_analysis_key = video_chunk.replace('.mp4', '_analysis.json')
  compliance_analysis_valid_json_string = json.dumps(compliance_analysis_valid_json)
  s3_client.put_object(Bucket=bucket_name, Key=compliance_analysis_key, Body=compliance_analysis_valid_json_string)

  if chunk_count == 0:
    set_analysis_results(
        bucket=bucket_name,
        s3_video_key=s3_object_key,
        model_id=config_model_id,
        prompt=message_content[1]['text'],
        system_prompt=system_prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        usage_output_tokens=output_tokens,
        usage_input_tokens=input_tokens,
        stop_reason=stop_reason,
        result_raw=compliance_analysis_valid_json_string,
        result_json=compliance_analysis_valid_json,
        frame_analysis_FPS=fpsByContentType
    )
  else:
    update_analysis_results(
      session_id=session_id,
      usage_output_tokens=output_tokens,
      usage_input_tokens=input_tokens
    )
  
  # Calculate costs and get provider
  model_provider, model, input_token_cost, output_token_cost = commoncode.calculate_model_cost(config_model_id, input_tokens, output_tokens)
  
  # Save statistics
  commoncode.save_statistics(
    session_id=session_id,
    identity_id=identity_id,
    input_tokens=input_tokens,
    output_tokens=output_tokens,
    input_token_cost=input_token_cost,
    output_token_cost=output_token_cost,
    model_id=config_model_id,
    model=model,
    processing_time=processing_time,
    model_provider=model_provider,
    processing_type="Video",
    content_type=content_type,
    duration=float(commoncode.get_tag_value(bucket_name, s3_object_key, 'DurationSeconds'))
  )

  return compliance_analysis_valid_json

def lambda_handler(event, context):
    print(f"GenerateComplianceReportTask - Input parameters: {json.dumps(event, indent=2)}")
    
    try:
        s3_object_key = event.get('s3VideoObjectKey')
        bucket_name = event.get('bucketName')
        
        chunks_prefix = commoncode.get_chunk_prefix(s3_object_key)
        config, config_type = commoncode.get_relevant_config(bucket_name, s3_object_key)

        commoncode.log_output_message(bucket_name, s3_object_key, f"Using {config_type} configuration parameters")

        response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=chunks_prefix)
        chunk_files = [obj['Key'] for obj in response.get('Contents', []) if obj['Key'].endswith('.mp4')]
        analysis_files = [obj['Key'] for obj in response.get('Contents', []) if obj['Key'].endswith('_analysis.json')]        

        chunk_count = 0
        result = None
        for chunk_file in chunk_files:
            print("check ", chunk_file)
            analysis_file = chunk_file.replace('.mp4', '_analysis.json')
            
            if analysis_file not in analysis_files:
                transcript_file = chunk_file.replace('.mp4', '.vtt')
                
                # Determine provider based on model ID
                general_config = config.get('defaultGeneralReportConfig')
                config_model_id = general_config.get('bedrockModelId')
                
                if 'twelvelabs' in config_model_id.lower():
                    result = send_to_pegasus(bucket_name, s3_object_key, chunk_file, config, chunk_count)
                else:
                    result = send_to_nova(bucket_name, s3_object_key, chunk_file, transcript_file, config, chunk_count)
                    
                if result:
                    commoncode.log_output_message(bucket_name, s3_object_key, f"Analyzed video-level segment {chunk_count}")

                return {
                    'allChunksAnalysed': False,
                    'chunk_count' : chunk_count
                }

            chunk_count += 1

        return {
            'allChunksAnalysed': True,
            'chunk_count' : chunk_count
        }
        
    except Exception as e:
        commoncode.log_output_message(bucket_name, s3_object_key, 'Error in chunk analysis: ' + str(e), 'error')
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

  # update the token count because agentic updates contributes to the step 1 processing required, and we 
  # want to show the total aggregate tokens used
  update_analysis_results(
    session_id=session_id, 
    usage_output_tokens=metrics['outputTokens'],
    usage_input_tokens=metrics['inputTokens']
  )

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