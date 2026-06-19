import boto3
import json
import urllib.parse
import commoncode

s3 = boto3.client('s3')
stepfunctions = boto3.client('stepfunctions')

params = commoncode.get_parameters()

def lambda_handler(event, context):
    """
    Lambda function triggered by S3 object creation to start compliance workflow
    """
    print(f"Event: {json.dumps(event)}")
    # Parse S3 event
    if 'Records' not in event:
        raise ValueError("No S3 records found in event")
    
    record = event['Records'][0]
    bucket = record['s3']['bucket']['name']
    s3_video_object_key = urllib.parse.unquote_plus(record['s3']['object']['key'], encoding='utf-8')
     
    step_function_arn = params['STEP_FUNCTION_ARN']
    
    session_id = commoncode.extract_session_from_object(bucket, s3_video_object_key)  
    s3_transcript_object_key = None
    
    # Check if transcript exists by looking at object tags
    try:
        tags_response = s3.get_object_tagging(
            Bucket=bucket,
            Key=s3_video_object_key
        )
        
        tag_set = tags_response.get('TagSet', [])

        # Find transcript tag
        transcript_tag = next((tag for tag in tag_set if tag['Key'] == 'TranscriptS3Key'), None)
        if transcript_tag and transcript_tag.get('Value'):
            print(f"Transcript found: {transcript_tag['Value']}")
            s3_transcript_object_key = transcript_tag['Value']
        else:
            print("No transcript found")

        # Find Mimir item ID tag (set by mimirActionHandler when copying from Mimir)
        mimir_item_id_tag = next((tag for tag in tag_set if tag['Key'] == 'MimirItemId'), None)
        if mimir_item_id_tag and mimir_item_id_tag.get('Value'):
            print(f"Mimir Item ID found: {mimir_item_id_tag['Value']}")
        else:
            print("No Mimir Item ID found (not a Mimir-originated asset)")

    except Exception as error:
        print(f"No tags found or error retrieving tags: {error}")

    
    # Get model ID from configuration
    try:
        config, config_type = commoncode.get_relevant_config(bucket, s3_video_object_key)
        bedrock_model_id = config.get('defaultGeneralReportConfig', {}).get('bedrockModelId', '')
    except Exception as e:
        print(f"Could not retrieve model ID from config: {e}")
        bedrock_model_id = ''
    
    # Start Step Function execution
    execution_name = f"compliance-{session_id}"
    
    step_function_input = {
        "bucketName": bucket,
        "s3VideoObjectKey": s3_video_object_key,
        "bedrockModelId": bedrock_model_id
    }

    # Add transcript result if available
    if s3_transcript_object_key:
        step_function_input["transcriptResult"] = {
            "Payload": {
                "s3TranscriptObjectKey": s3_transcript_object_key
            }
        }

    try:
        print(f"Starting compliance workflow for video: {bucket}/{s3_video_object_key}")
        print(f"Input for workflow: {step_function_input}")

        response = stepfunctions.start_execution(
            stateMachineArn=step_function_arn,
            name=execution_name,
            input=json.dumps(step_function_input)
        )
        
        commoncode.log_output_message(s3_video_object_key, 'Workflow started.')
        print(f"Started Step Function execution: {response['executionArn']}")
        
        return {
            'message': 'Compliance workflow started successfully',
            'executionArn': response['executionArn']
        }
        
    except Exception as e:
        error_msg = f"Error starting Compliance Workflow Step Function: {str(e)}"
        print(error_msg)
        raise e