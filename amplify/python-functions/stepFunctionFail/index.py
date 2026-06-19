import json
import commoncode

def lambda_handler(event, context):
    print(f"Step Function failed with event: {json.dumps(event, indent=2)}")
    s3VideoObjectKey = event.get('s3VideoObjectKey')
    bucketName = event.get('bucketName')
    commoncode.log_output_message(bucketName, s3VideoObjectKey, f"There were some errors in processing. {event}", "error")
    
    raise Exception("Processing failed")
    