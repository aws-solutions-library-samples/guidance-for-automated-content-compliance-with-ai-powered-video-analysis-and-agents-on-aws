import boto3
import os
import subprocess
import glob
import re
import commoncode

s3_client = boto3.client('s3')

CHUNK_LENGTH = '00:15:00'
INPUT_FILE = '/tmp/input.mp4'
OUTPUT_PATTERN = '/tmp/chunk%03d.mp4'

def lambda_handler(event, context):
    bucket = event.get('bucketName')
    s3_object_key = event.get('s3VideoObjectKey')
    chunks_prefix = commoncode.get_chunk_prefix(s3_object_key)
    
    commoncode.log_output_message(bucket, s3_object_key, "Starting video segmentation", "Segmentation")

    # Download video to /tmp
    s3_client.download_file(bucket, s3_object_key, INPUT_FILE)
    
    # Extract video duration using ffmpeg (ffprobe not available in layer)
    try:
        duration_cmd = [
            '/opt/ffmpeg', '-i', INPUT_FILE
        ]
        result = subprocess.run(duration_cmd, capture_output=True, text=True)
        # ffmpeg prints duration to stderr in format "Duration: HH:MM:SS.ms"
        duration_match = re.search(r'Duration:\s*(\d+):(\d+):(\d+)\.(\d+)', result.stderr)
        if not duration_match:
            raise RuntimeError(f"Failed to extract video duration from ffmpeg output")
        hours, minutes, seconds = int(duration_match.group(1)), int(duration_match.group(2)), int(duration_match.group(3))
        duration_seconds = hours * 3600 + minutes * 60 + seconds
        commoncode.set_tag_value(bucket, s3_object_key, 'DurationSeconds', str(duration_seconds))
    except Exception as e:
        commoncode.log_output_message(bucket, s3_object_key, f"Failed to extract video duration: {str(e)}", "error")
        raise

    # Run FFmpeg to create chunks
    cmd = [
        '/opt/ffmpeg',
        '-i', INPUT_FILE,
        '-c', 'copy',
        '-segment_time', CHUNK_LENGTH,
        '-f', 'segment',
        '-reset_timestamps', '1',
        OUTPUT_PATTERN
    ]
    
    subprocess.run(cmd, check=True)
    
    # Upload all chunk files to S3
    chunk_files = glob.glob('/tmp/chunk*.mp4')
    for chunk_file in chunk_files:
        chunk_name = os.path.basename(chunk_file)
        print(f"Upload {chunk_name}")
        s3_key = chunks_prefix + chunk_name
        s3_client.upload_file(chunk_file, bucket, s3_key)
        os.remove(chunk_file)
    
    os.remove(INPUT_FILE)

    commoncode.log_output_message(bucket, s3_object_key, f"Segmentation complete. There are {len(chunk_files)} chunk(s)")

    return {
        'chunks_prefix': chunks_prefix,
        'chunk_count': len(chunk_files),
        'duration_seconds': duration_seconds
    }