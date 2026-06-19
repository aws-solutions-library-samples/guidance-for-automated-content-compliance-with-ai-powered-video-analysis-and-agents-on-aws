import boto3
import json
import commoncode

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    bucket = event.get('bucketName')
    video_key = event.get('s3VideoObjectKey')
    session_id = commoncode.extract_session_from_object(bucket, video_key)
    user_id = commoncode.extract_identity_from_path(video_key)
    filename = commoncode.extract_filename_from_path(video_key)    

    if not bucket or not video_key or not user_id or not session_id:
        raise ValueError("Invalid input: bucket, video_key, session_id and user_id must not be empty")

    output_prefix = f"processed/video/{user_id}/{filename}"
    
    # Get MediaConvert endpoint
    mediaconvert = boto3.client('mediaconvert')    
    endpoints = mediaconvert.describe_endpoints()
    endpoint_url = endpoints['Endpoints'][0]['Url']
    mediaconvert = boto3.client('mediaconvert', endpoint_url=endpoint_url)
    
    job_id = commoncode.get_tag_value(bucket, video_key, 'mcJobId', False)
    
    if not job_id:
        # Create MediaConvert job
        print("Creating MediaConvert job")
        job_id = create_mediaconvert_job(mediaconvert, bucket, video_key, output_prefix, session_id)

        return {
            'allAssetsGenerated': 'False'
        }
    
    print("Checking MediaConvert Job")
    response = mediaconvert.get_job(Id=job_id)

    print(response['Job']['Status'])
    if response['Job']['Status'] != 'COMPLETE':
        return {
            'allAssetsGenerated': 'False'
        }

    manifest = generate_thumbnail_manifest(s3_client, bucket, video_key, output_prefix)

    return {
        'allAssetsGenerated': 'True',        
        'output_prefix': output_prefix,
        'hls_path': f"{output_prefix}/hls",
        'playlist_key': f"{output_prefix}/hls/playlist.m3u8",
        'thumbnail_prefix': f"{output_prefix}/thumbnails/",
        'thumbnail_manifest': manifest
    }

def create_mediaconvert_job(mediaconvert, bucket, video_key, output_prefix, session_id):
    """
    Create MediaConvert job for video processing
    """
    input_uri = f"s3://{bucket}/{video_key}"
    output_uri = f"s3://{bucket}/{output_prefix}"
    
    role_arn = commoncode.get_parameters()['MEDIACONVERT_ROLE_ARN']
    
    fps = commoncode.get_fps(bucket, video_key)
    commoncode.log_output_message(bucket, video_key, f"Starting video frame extraction at {fps} Frames per Second")

    job_settings = {
        "Role": role_arn,
        "Settings": {
            "Inputs": [{
                "FileInput": input_uri,
                "AudioSelectors": {
                    "Audio Selector 1": {
                        "DefaultSelection": "DEFAULT"
                    }
                },
                "VideoSelector": {}
            }],
            "OutputGroups": [
                {
                    "Name": "Apple HLS",
                    "Outputs": [
                        {
                            "Preset": "System-Avc_16x9_360p_29_97fps_600kbps",
                            "NameModifier": "_640"
                        }
                    ],
                    "OutputGroupSettings": {
                        "Type": "HLS_GROUP_SETTINGS",
                        "HlsGroupSettings": {
                            "SegmentLength": 10,
                            "Destination": f"{output_uri}/hls/",
                            "MinSegmentLength": 0
                        }
                    }
                },
                {
                "Name": "File Group",
                "Outputs": [
                    {
                    "ContainerSettings": {
                        "Container": "RAW"
                    },
                    "VideoDescription": {
                        "CodecSettings": {
                        "Codec": "FRAME_CAPTURE",
                        "FrameCaptureSettings": {
                            "FramerateNumerator": fps,
                            "FramerateDenominator": 1,
                            "MaxCaptures": 100000
                        }
                        }
                    },
                    }
                ],
                "OutputGroupSettings": {
                    "Type": "FILE_GROUP_SETTINGS",
                    "FileGroupSettings": {
                    "Destination": f"{output_uri}/thumbnails/"
                    }
                }
                }
            ]
        }
    }
    
    response = mediaconvert.create_job(**job_settings)
    commoncode.set_tag_value(bucket, video_key, 'mcJobId', response['Job']['Id'])
    return response['Job']['Id']

def generate_thumbnail_manifest(s3_client, bucket, video_key, output_prefix):
    """
    Generate manifest file for thumbnails
    """
    thumbnail_prefix = f"{output_prefix}/thumbnails/"
    thumbnail_manifest = f"{thumbnail_prefix}manifest.json"
    
    print("Generating manifest ", thumbnail_manifest)

    # List thumbnail files with pagination
    thumbnail_keys = []
    continuation_token = None
    
    while True:
        if continuation_token:
            response = s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix=thumbnail_prefix,
                ContinuationToken=continuation_token
            )
        else:
            response = s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix=thumbnail_prefix
            )
        
        for obj in response.get('Contents', []):
            if obj['Key'].endswith('.jpg'):
                thumbnail_keys.append({
                    'bucketName': bucket,
                    's3VideoObjectKey' : video_key,
                    'thumbnail': obj['Key']
                })
        
        if response.get('IsTruncated'):
            continuation_token = response['NextContinuationToken']
        else:
            print("Thumbnail manifest contains", str(len(thumbnail_keys)), " thumbnails")
            s3_client.put_object(
                Bucket=bucket,
                Key=thumbnail_manifest,
                Body=json.dumps(thumbnail_keys),
                ContentType='application/json'
            )
            
            return thumbnail_manifest
        