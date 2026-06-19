import json
import boto3
import re
from datetime import datetime, timezone
import commoncode
from botocore.config import Config
from botocore.exceptions import ClientError


s3_client = boto3.client('s3')
dynamodb = boto3.client('dynamodb')
agent_runtime_client = boto3.client('bedrock-agent-runtime', config = Config(
    connect_timeout=900,  # 15 minutes
    read_timeout=900,     # 15 minutes
    retries={'max_attempts': 1}
))

def update_analysis_results(session_id: str, usage_output_tokens: int, usage_input_tokens: int, rights_result_raw: str = None, qc_result_raw: str = None, imdb_result_raw: str = None):
    analysis_results_table = commoncode.get_parameters()['ANALYSIS_RESULTS_TABLE']        
    now = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')    

    expression = "ADD usageInputTokens :usageInputTokens, usageOutputTokens :usageOutputTokens SET updatedAt = :now"

    expression_values = {
       ':usageInputTokens' : { 'N' : str(usage_input_tokens) },
       ':usageOutputTokens' : { 'N' : str(usage_output_tokens) },
       ':now' : { 'S' : now }
    }

    if rights_result_raw:
      expression += ", rightsResultRaw = :rightsResultRaw" 
      expression_values[':rightsResultRaw'] = {"S" : rights_result_raw}

    if qc_result_raw:
      expression += ", qcResultRaw = :qcResultRaw" 
      expression_values[':qcResultRaw'] = {"S" : qc_result_raw}

    if imdb_result_raw:
      expression += ", imdbResultRaw = :imdbResultRaw" 
      expression_values[':imdbResultRaw'] = {"S" : imdb_result_raw}

    dynamodb.update_item(
        TableName=analysis_results_table,
        Key={'sessionId': {'S': session_id}},
        UpdateExpression=expression,
        ExpressionAttributeValues=expression_values
    )



def lambda_handler(event, context):
    s3_object_key = event.get('s3VideoObjectKey')
    bucket_name = event.get('bucketName')

    try:
        commoncode.log_output_message(bucket_name, s3_object_key, f"Agent: Validating rights", "Rights")
        invoke_rights_agent(bucket_name, s3_object_key)
        # commoncode.log_output_message(bucket_name, s3_object_key, f"Rights validation completed")
    except ClientError as e:
        commoncode.log_output_message(bucket_name, s3_object_key, f"Error validating rights", "error")
        print(f"Client error: {str(e)}")

    try:
        commoncode.log_output_message(bucket_name, s3_object_key, f"Agent: Validating file Quality Control", "Quality Control")
        invoke_qc_agent(bucket_name, s3_object_key)
        # commoncode.log_output_message(bucket_name, s3_object_key, f"QC validation completed")
    except ClientError as e:
        commoncode.log_output_message(bucket_name, s3_object_key, f"Error validating QC", "error")
        print(f"Client error: {str(e)}")

    try:
        commoncode.log_output_message(bucket_name, s3_object_key, f"Agent: Validating IMDb data", "IMDb")

        analysis_prefix = commoncode.get_analysis_prefix(s3_object_key)
        general_compliance_report = commoncode.load_s3_json_file(bucket_name, f"{analysis_prefix}general_analysis.json")

        invoke_imdb_agent(bucket_name, s3_object_key, general_compliance_report)
        # commoncode.log_output_message(bucket_name, s3_object_key, f"IMDb validation completed")
    except ClientError as e:
        commoncode.log_output_message(bucket_name, s3_object_key, f"Error validating IMDb", "error")
        print(f"Client error: {str(e)}")

    # Only allow the user to go to the results page when the agents have finished completing
    commoncode.log_output_message(bucket_name, s3_object_key, f"General compliance analysis completed successfully")

    return {}

def invoke_imdb_agent(bucket, s3_object_video_key, compliance_analysis_result):
  print("Invoking IMDb Agent")
  session_id = commoncode.extract_session_from_object(bucket, s3_object_video_key)
  identity_id = commoncode.extract_identity_from_path(s3_object_video_key)

  params = commoncode.get_parameters()
  agent_id = params['IMDB_AGENT_ID']
  agent_alias_id = params['IMDB_AGENT_ALIAS_ID']

  filename = commoncode.get_tag_value(bucket, s3_object_video_key, 'OriginalFilename')

  prompt = f"""Validate compliance analysis results against IMDB Parents Guide data for video file: ##FILENAME## "{filename}" ##FILENAME##.

  TASK: Cross-reference the compliance analysis findings with IMDB Parents Guide entries across all 5 categories:
  1. Sex & Nudity
  2. Violence & Gore  
  3. Profanity
  4. Alcohol, Drugs & Smoking
  5. Frightening & Intense Scenes

  For each category, analyze:
  - IMDB Parents Guide severity rating (None, Mild, Moderate, Severe, or empty if no entry)
  - IMDB Parents Guide descriptive text entries
  - Compliance analysis findings and flags for that category
  - Cross-reference validation between IMDB data and analysis results

  VALIDATION CRITERIA:
  - CONFIRMED: Analysis findings directly match or support IMDB entries
  - SIMILAR FINDINGS: Analysis findings are related but not exact matches to IMDB entries  
  - NOT VALIDATED: Analysis findings contradict IMDB entries
  - NO EVIDENCE: IMDB has entries but analysis found no corresponding evidence
  - NO IMDB ENTRY: No IMDB data exists for this category (empty severity or empty text)

  <answer>
  Provide structured JSON response matching the expected frontend format:
  {{
    "summaryStatistics": {{
      "totalEntries": number,
      "confirmedMatches": number,
      "similarFindings": number,
      "notValidated": number,
      "overallAccuracyPercentage": number
    }},
    "validationResults": {{
      "Sex & Nudity": {{
        "validationResult": "CONFIRMED|SIMILAR FINDINGS|NOT VALIDATED|NO_EVIDENCE|NO IMDB ENTRY",
        "confidenceScore": 0.0-1.0,
        "imdbEntry": "IMDB parent guide text or array of texts",
        "complianceAnalysis": "relevant findings from compliance analysis",
        "analysisNotes": "detailed explanation of validation result"
      }},
      "Violence & Gore": {{
        "validationResult": "CONFIRMED|SIMILAR FINDINGS|NOT VALIDATED|NO EVIDENCE|NO IMDB ENTRY",
        "confidenceScore": 0.0-1.0,
        "imdbEntry": "IMDB parent guide text or array of texts",
        "complianceAnalysis": "relevant findings from compliance analysis",
        "analysisNotes": "detailed explanation of validation result"
      }},
      "Profanity": {{
        "validationResult": "CONFIRMED|SIMILAR FINDINGS|NOT VALIDATED|NO_EVIDENCE|NO IMDB ENTRY",
        "confidenceScore": 0.0-1.0,
        "imdbEntry": "IMDB parent guide text or array of texts",
        "complianceAnalysis": "relevant findings from compliance analysis",
        "analysisNotes": "detailed explanation of validation result"
      }},
      "Alcohol, Drugs & Smoking": {{
        "validationResult": "CONFIRMED|SIMILAR FINDINGS|NOT VALIDATED|NO EVIDENCE|NO IMDB ENTRY",
        "confidenceScore": 0.0-1.0,
        "imdbEntry": "IMDB parent guide text or array of texts",
        "complianceAnalysis": "relevant findings from compliance analysis",
        "analysisNotes": "detailed explanation of validation result"
      }},
      "Frightening & Intense Scenes": {{
        "validationResult": "CONFIRMED|SIMILAR FINDINGS|NOT VALIDATED|NO EVIDENCE|NO IMDB ENTRY",
        "confidenceScore": 0.0-1.0,
        "imdbEntry": "IMDB parent guide text or array of texts",
        "complianceAnalysis": "relevant findings from compliance analysis",
        "analysisNotes": "detailed explanation of validation result"
      }}
    }}
  }}
  
  If no IMDB data exists for the file, return JSON with NO IMDB ENTRY for all categories and zero summary statistics.
  </answer>

  ##COMPLIANCE ANALYSIS RESULTS##:
  {json.dumps(compliance_analysis_result, indent=2)}
  ##COMPLIANCE ANALYSIS RESULTS##

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
    #Collect agent output.
    if 'chunk' in event:
      chunk = event["chunk"]
      completion += chunk["bytes"].decode()
    
    # Log trace output.
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

  print(f"IMDb agent response: {completion}")

  update_analysis_results(
     session_id=session_id, 
     usage_output_tokens=metrics['outputTokens'], 
     usage_input_tokens=metrics['inputTokens'], 
     imdb_result_raw=completion
  )

  # Save statistics for imdb agent
  imdb_model_provider, imdb_model, imdb_input_token_cost, imdb_output_token_cost = commoncode.calculate_model_cost(metrics['modelId'], metrics['inputTokens'], metrics['outputTokens'])
  commoncode.save_statistics(
    session_id=session_id,
    identity_id=identity_id,
    input_tokens=metrics['inputTokens'],
    output_tokens=metrics['outputTokens'],
    input_token_cost=imdb_input_token_cost,
    output_token_cost=imdb_output_token_cost,
    model_id=metrics['modelId'],
    model=imdb_model,
    processing_time=metrics['totalTimeMs'] / 1000,
    model_provider=imdb_model_provider,
    processing_type="Agent",
    content_type="IMDb Validation",
    duration=0.0
  )  

  return completion, metrics

def invoke_rights_agent(bucket, s3_object_video_key):
  print("Invoking Rights Agent")
  session_id = commoncode.extract_session_from_object(bucket, s3_object_video_key)
  identity_id = commoncode.extract_identity_from_path(s3_object_video_key)

  params = commoncode.get_parameters()
  agent_id = params['RIGHTS_AGENT_ID']
  agent_alias_id = params['RIGHTS_AGENT_ALIAS_ID']

  # This can be made flexible in the future
  usage_type = "standard"
  filename = commoncode.get_tag_value(bucket, s3_object_video_key, 'OriginalFilename')

  prompt = f"""Verify rights and clearance status for file name: {filename}, for {usage_type} usage.
  Make sure to return valid JSON with the following top-level keys: 
  - asset_verified
  - filename, 
  - rights_status
  - contacts
  - warnings
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
    #Collect agent output.
    if 'chunk' in event:
      chunk = event["chunk"]
      completion += chunk["bytes"].decode()
    
    # Log trace output.
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

  print(f"Rights agent response: {completion}")

  update_analysis_results(
     session_id=session_id, 
     usage_output_tokens=metrics['outputTokens'], 
     usage_input_tokens=metrics['inputTokens'], 
     rights_result_raw=completion
  )

  # Save statistics for rights agent
  rights_model_provider, rights_model, rights_input_token_cost, rights_output_token_cost = commoncode.calculate_model_cost(metrics['modelId'], metrics['inputTokens'], metrics['outputTokens'])
  commoncode.save_statistics(
    session_id=session_id,
    identity_id=identity_id,
    input_tokens=metrics['inputTokens'],
    output_tokens=metrics['outputTokens'],
    input_token_cost=rights_input_token_cost,
    output_token_cost=rights_output_token_cost,
    model_id=metrics['modelId'],
    model=rights_model,
    processing_time=metrics['totalTimeMs'] / 1000,
    model_provider=rights_model_provider,
    processing_type="Agent",
    content_type="Rights Validation",
    duration=0.0
  )  


  return completion, metrics

def invoke_qc_agent(bucket, s3_object_video_key):
  print("Invoking QC Agent")  
  session_id = commoncode.extract_session_from_object(bucket, s3_object_video_key)
  identity_id = commoncode.extract_identity_from_path(s3_object_video_key)

  params = commoncode.get_parameters()
  agent_id = params['QC_AGENT_ID']
  agent_alias_id = params['QC_AGENT_ALIAS_ID']

  # Get the original filename from S3 tags (not the S3 object key)
  original_filename = commoncode.get_tag_value(bucket, s3_object_video_key, 'OriginalFilename')

  # Get transcription results to extract detected language (not available for Twelve Labs models)
  transcript_s3_key = ''
  try:
    transcript_s3_key = commoncode.get_tag_value(bucket, s3_object_video_key, 'TranscriptS3Key')
  except:
    # Transcript not available (e.g., for Twelve Labs Pegasus model)
    pass
  print(f"QC Validation - Transcript S3 key: {transcript_s3_key}")
  
  detected_language = get_detected_language_from_transcript(bucket, transcript_s3_key)

  print(f"QC Validation - Original filename: {original_filename}")
  print(f"QC Validation - Detected language from transcript: {detected_language}")
  print(f"QC Validation - About to call QC agent with filename='{original_filename}' and detected_language='{detected_language}'")

  prompt = f"""Validate language consistency for the uploaded file.
  
  Original filename: {original_filename}
  Detected transcription language: {detected_language}
  
  Analyze the filename for language codes and validate consistency with the detected transcription language.
  
  Instructions:
  1. Extract language code from the original filename (support formats: enUS, jaJP, en-US, ja-JP, en, ja)
  2. If no language code is found in filename, assume English (EN-US)
  3. Compare filename language with detected transcription language
  4. Provide validation results
  
  Make sure to return valid JSON with the following top-level keys: 
  - qc_status (PASS/FAIL/WARNING)
  - filename_language (language extracted from filename)
  - content_language (language detected from transcription - same as detected_language)
  - validation_method (always "transcription")
  - confidence (confidence percentage)
  - issues (array of validation issues/results)
  - summary (summary message)
  - recommendations (array of recommendations)
  - analysis_metadata (object with language_match boolean and validation_source string)
  
  For analysis_metadata, include:
  - language_match: true if filename_language matches content_language, false otherwise
  - validation_source: "Amazon Bedrock"
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
    #Collect agent output.
    if 'chunk' in event:
      chunk = event["chunk"]
      completion += chunk["bytes"].decode()

    # Log trace output.
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

  print(f"QC agent response: {completion}")

  # Validate and normalize QC response structure
  try:
    qc_response = json.loads(completion)
    
    # Ensure all required fields are present with defaults
    normalized_response = {
      "qc_status": qc_response.get("qc_status", "UNKNOWN"),
      "filename_language": qc_response.get("filename_language", "EN-US"),
      "content_language": qc_response.get("content_language") or qc_response.get("detected_language", detected_language),
      "validation_method": qc_response.get("validation_method", "transcription"),
      "confidence": qc_response.get("confidence", 85),
      "issues": qc_response.get("issues", []),
      "summary": qc_response.get("summary", "Language validation completed"),
      "recommendations": qc_response.get("recommendations", []),
      "analysis_metadata": {
        "language_match": qc_response.get("analysis_metadata", {}).get("language_match", 
                          qc_response.get("filename_language", "EN-US") == (qc_response.get("content_language") or qc_response.get("detected_language", detected_language))),
        "validation_source": qc_response.get("analysis_metadata", {}).get("validation_source", "Amazon Bedrock"),
        "content_confidence": qc_response.get("confidence", 85),
        "filename_confidence": 85
      }
    }
    
    completion = json.dumps(normalized_response)
    print(f"Normalized QC response: {completion}")
    
  except json.JSONDecodeError as e:
    print(f"Failed to parse QC response as JSON: {e}")
    # Create a fallback response structure
    fallback_response = {
      "qc_status": "WARNING",
      "filename_language": "EN-US",
      "content_language": detected_language,
      "validation_method": "transcription",
      "confidence": 50,
      "issues": ["Failed to parse QC agent response"],
      "summary": "QC validation completed with parsing errors",
      "recommendations": ["Review QC agent response format"],
      "analysis_metadata": {
        "language_match": detected_language == "EN-US",
        "validation_source": "Amazon Bedrock",
        "content_confidence": 50,
        "filename_confidence": 85
      }
    }
    completion = json.dumps(fallback_response)

  update_analysis_results(
     session_id=session_id, 
     usage_output_tokens=metrics['outputTokens'], 
     usage_input_tokens=metrics['inputTokens'], 
     rights_result_raw=None,
     qc_result_raw=completion
  )

  # Save statistics for QC agent
  qc_model_provider, qc_model, qc_input_token_cost, qc_output_token_cost = commoncode.calculate_model_cost(metrics['modelId'], metrics['inputTokens'], metrics['outputTokens'])
  commoncode.save_statistics(
    session_id=session_id,
    identity_id=identity_id,
    input_tokens=metrics['inputTokens'],
    output_tokens=metrics['outputTokens'],
    input_token_cost=qc_input_token_cost,
    output_token_cost=qc_output_token_cost,
    model_id=metrics['modelId'],
    model=qc_model,
    processing_time=metrics['totalTimeMs'] / 1000,
    model_provider=qc_model_provider,
    processing_type="Agent",
    content_type="Quality Control",
    duration=0.0
  )  

  return completion, metrics


## Helper functions for detecting language from transcript
def get_detected_language_from_transcript(bucket, transcript_s3_key):
  """Extract detected language from transcription results using Bedrock Nova Pro"""
  try:
    if not transcript_s3_key:
      print("No transcript S3 key available - defaulting to EN-US")
      return "EN-US"

    print(f"Getting transcript from S3: {bucket}/{transcript_s3_key}")
    response = s3_client.get_object(Bucket=bucket, Key=transcript_s3_key)
    transcript_content = response['Body'].read().decode('utf-8')

    # Extract text content from transcript
    text_content = ""
    if transcript_content.startswith('WEBVTT'):
      # Extract text from WebVTT format
      lines = transcript_content.split('\n')
      for line in lines:
        if (not line.startswith('WEBVTT') and 
            not line.startswith('NOTE') and
            not '-->' in line and
            line.strip() and
            not line.strip().isdigit()):
          text_content += line + " "
    else:
      # Try to parse as JSON
      try:
        transcript_json = json.loads(transcript_content)
        if 'results' in transcript_json and 'transcripts' in transcript_json['results']:
          transcripts = transcript_json['results']['transcripts']
          if len(transcripts) > 0 and 'transcript' in transcripts[0]:
            text_content = transcripts[0]['transcript']
      except json.JSONDecodeError:
        text_content = transcript_content

    # Sample up to 1500 characters from the transcript for better accuracy.
    # Take from the start and, if long enough, also from the middle to avoid
    # music cues / silence markers that often appear at the beginning.
    if not text_content or not text_content.strip():
      print("No text content found in transcript")
      return "EN-US"

    text_len = len(text_content)
    if text_len <= 1500:
      text_sample = text_content
    else:
      start_chunk = text_content[:750]
      mid_start = text_len // 2 - 375
      mid_chunk = text_content[mid_start:mid_start + 750]
      text_sample = start_chunk + "\n...\n" + mid_chunk

    print(f"Language detection sample length: {len(text_sample)} chars (transcript total: {text_len})")

    # Supported language codes and a mapping from base/partial codes to full codes
    supported_languages = {
      'EN-US', 'EN-GB', 'EN-AU', 'JA-JP', 'ES-US',
      'FR-FR', 'DE-DE', 'IT-IT', 'PT-BR', 'KO-KR', 'ZH-CN'
    }
    base_to_full = {
      'EN': 'EN-US', 'JA': 'JA-JP', 'ES': 'ES-US', 'FR': 'FR-FR',
      'DE': 'DE-DE', 'IT': 'IT-IT', 'PT': 'PT-BR', 'KO': 'KO-KR', 'ZH': 'ZH-CN',
    }

    # Use Bedrock Nova Lite for language identification (fast + cost-effective)
    bedrock_client = boto3.client('bedrock-runtime')

    prompt = f"""You are a language identification system. Analyze the following transcript text and respond with exactly one language code from this list:
EN-US, EN-GB, EN-AU, JA-JP, ES-US, FR-FR, DE-DE, IT-IT, PT-BR, KO-KR, ZH-CN

Rules:
- Return ONLY the language code, nothing else
- If the text is Italian, return IT-IT
- If the text is Spanish, return ES-US
- If the text is French, return FR-FR
- If the text is German, return DE-DE
- If the text is Japanese, return JA-JP
- If the text is Korean, return KO-KR
- If the text is Chinese, return ZH-CN
- If the text is Portuguese, return PT-BR
- If the text is English, return EN-US

Transcript text:
{text_sample}"""

    request_body = {
      "messages": [
        {
          "role": "user",
          "content": [{"text": prompt}]
        }
      ],
      "inferenceConfig": {
        "maxTokens": 10,
        "temperature": 0
      }
    }

    response = bedrock_client.invoke_model(
      modelId="global.amazon.nova-2-lite-v1:0",
      body=json.dumps(request_body)
    )

    response_body = json.loads(response['body'].read())
    raw_response = response_body['output']['message']['content'][0]['text'].strip().upper()
    print(f"Raw Bedrock language response: '{raw_response}'")

    # Try exact match first
    if raw_response in supported_languages:
      print(f"Detected language: {raw_response}")
      return raw_response

    # Try to find a supported code anywhere in the response (e.g. "IT-IT." or "The language is IT-IT")
    import re
    code_match = re.search(r'([A-Z]{2}-[A-Z]{2})', raw_response)
    if code_match and code_match.group(1) in supported_languages:
      detected = code_match.group(1)
      print(f"Detected language (extracted from response): {detected}")
      return detected

    # Try base code mapping (e.g. model returned "IT" instead of "IT-IT")
    base_match = re.search(r'\b([A-Z]{2})\b', raw_response)
    if base_match and base_match.group(1) in base_to_full:
      detected = base_to_full[base_match.group(1)]
      print(f"Detected language (mapped from base code '{base_match.group(1)}'): {detected}")
      return detected

    print(f"Could not parse language from Bedrock response: '{raw_response}', defaulting to EN-US")
    return "EN-US"

  except Exception as e:
    print(f"Error detecting language from transcript: {str(e)}")
    return "EN-US"