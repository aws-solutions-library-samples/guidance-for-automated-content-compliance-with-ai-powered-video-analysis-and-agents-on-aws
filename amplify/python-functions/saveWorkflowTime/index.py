import commoncode

def lambda_handler(event, context):
    bucket_name = event.get('bucketName')
    s3_object_key = event.get('s3VideoObjectKey')
    execution_start_time = event.get('executionStartTime')

    commoncode.save_workflow_time(bucket_name, s3_object_key, execution_start_time)
    commoncode.log_output_message(bucket_name, s3_object_key, "Video and frame analysis completed")

    return {}
