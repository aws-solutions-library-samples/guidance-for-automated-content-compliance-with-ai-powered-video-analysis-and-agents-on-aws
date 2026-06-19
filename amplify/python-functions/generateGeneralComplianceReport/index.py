import json
import boto3
import commoncode
import time
from datetime import datetime, timezone
from botocore.config import Config

bedrock_client = boto3.client('bedrock-runtime', config = Config(
    connect_timeout=900,  # 15 minutes
    read_timeout=900,     # 15 minutes
    retries={'max_attempts': 1}
))
s3_client = boto3.client('s3')
dynamodb = boto3.client('dynamodb')

def update_analysis_results(session_id: str, usage_output_tokens: int, usage_input_tokens: int, result_raw: str, result_json: dict):
    analysis_results_table = commoncode.get_parameters()['ANALYSIS_RESULTS_TABLE']        
    now = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')    

    expression = "ADD usageInputTokens :usageInputTokens, usageOutputTokens :usageOutputTokens \
        SET updatedAt = :now, resultRaw = :resultRaw, resultJSON = :resultJSON"

    expression_values = {
       ':usageInputTokens' : { 'N' : str(usage_input_tokens) },
       ':usageOutputTokens' : { 'N' : str(usage_output_tokens) },
       ':resultRaw' : { "S" : result_raw },
       ':resultJSON' : {'S': json.dumps(result_json)},
       ':now' : { 'S' : now }
    }

    dynamodb.update_item(
        TableName=analysis_results_table,
        Key={'sessionId': {'S': session_id}},
        UpdateExpression=expression,
        ExpressionAttributeValues=expression_values
    )

def merge_general_compliance_report(bucket_name, s3_object_key, results):
  # Hardcoded values for Claude 4.6 Sonnet
  config_model_id = 'global.anthropic.claude-sonnet-4-6'
  max_tokens = 10000
  temperature = 0.1
  top_k = 20
  
  # Build prompt text
  prompt_text = f"""
There are multiple json snippets below, one per line. Merge these into one comprehensive json response. Keep the original details and meaning, and try to merge the higher level topics.
If there is more than one Description for an entry, merge the values into one comprehensive sentence. 
If there is more than one Severity for an entry, select the maximum severity.

You MUST answer in valid JSON format only. Only generate the final JSON output. DO NOT provide any preamble or markdown, such as ```json.

"""
  
  for result in results:
      prompt_text += result + "\n"

  system_prompt = "You are an expert content compliance analyst specializing in media content evaluation. Your job is to merge the JSON results from segments of the analyzed media into one comprehensive JSON result"
  
  # Native Anthropic API format
  request_body = {
      "anthropic_version": "bedrock-2023-05-31",
      "max_tokens": max_tokens,
      "temperature": temperature,
      "top_k": top_k,
      "system": system_prompt,
      "messages": [
          {
              "role": "user",
              "content": [{"type": "text", "text": prompt_text}]
          }
      ]
  }
    
  processing_time = 0
  delay = 1

  while processing_time == 0:
    try:
        start_time = time.time()

        print(f"Sending to {config_model_id}")
        response = bedrock_client.invoke_model(
            modelId=config_model_id,
            body=json.dumps(request_body),
            contentType="application/json"
        )
        processing_time = time.time() - start_time

        response_body = commoncode.load_json(response['body'].read())
        print(response_body)

        usage = response_body.get('usage', {})
        input_tokens = usage.get('input_tokens', 0)
        output_tokens = usage.get('output_tokens', 0)
        stop_reason = response_body.get('stop_reason', '')

        if stop_reason == 'max_tokens':
            commoncode.log_output_message(bucket_name, s3_object_key, f"Max tokens reached when merging. Output may be incomplete.", "warning")

        text = response_body['content'][0]['text']

        update_analysis_results(
            commoncode.extract_session_from_object(bucket_name, s3_object_key), 
            output_tokens,
            input_tokens, 
            text, 
            commoncode.load_json(text)
        )

        return text

    except bedrock_client.exceptions.ThrottlingException:
        print(f"Throttling detected, retrying in {delay * 60} seconds")
        if delay > 3:
            commoncode.log_output_message(bucket_name, s3_object_key, f"Persistent Throttling detected when combining analysed chunks using {config_model_id}", "warning")
        
        time.sleep(delay * 60)
        delay += 1 


def lambda_handler(event, context):
    print(f"GenerateComplianceReportTask - Input parameters: {json.dumps(event, indent=2)}")
    
    try:
        s3_object_key = event.get('s3VideoObjectKey')
        bucket_name = event.get('bucketName')     
        chunks_prefix = commoncode.get_chunk_prefix(s3_object_key)

        # Process all analysis files
        response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=chunks_prefix)
        analysis_files = [obj['Key'] for obj in response.get('Contents', []) if obj['Key'].endswith('_analysis.json')]        

        results = []
        for file in analysis_files:
            analysis_json = s3_client.get_object(Bucket=bucket_name, Key=file)['Body'].read().decode('utf-8')
            results.append(analysis_json)

        general_compliance_report = results[0]
        if len(results) > 1:
            general_compliance_report = merge_general_compliance_report(bucket_name, s3_object_key, results)

        analysis_prefix = commoncode.get_analysis_prefix(s3_object_key)
        s3_client.put_object(Bucket=bucket_name, Key=f"{analysis_prefix}general_analysis.json", Body=general_compliance_report)

        return {
            'complianceAnalysis': 'completed',
        }
        
    except Exception as e:
        commoncode.log_output_message(bucket_name, s3_object_key, 'Error in compliance analysis: ' + str(e), 'error')
        raise e