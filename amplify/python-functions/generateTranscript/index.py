import boto3
import commoncode
from enum import Enum

s3 = boto3.client('s3')
transcribe = boto3.client('transcribe')

TRANSCRIBE_PRICE_SECONDS = 0.0004

def get_content_type(bucket, s3_video_object_key):
    try:
        return commoncode.get_tag_value(bucket, s3_video_object_key, 'ContentType')
    except Exception as error:
        print('Could not retrieve content type from tags')
        print(error)
    
    return 'unknown'

def lambda_handler(event, context):
    bucket = event.get('bucketName')
    s3_video_object_key = event.get('s3VideoObjectKey')

    if not bucket or not s3_video_object_key:
        raise ValueError("need bucket and s3_video_object_key")

    session_id = commoncode.extract_session_from_object(bucket, s3_video_object_key)
    chunks_prefix = s3_video_object_key.replace('assets/', 'processed/').replace('.mp4', '') + '/chunks/'
    all_complete = True    

    # List all chunk files
    response = s3.list_objects_v2(Bucket=bucket, Prefix=chunks_prefix)
    chunk_files = [obj['Key'] for obj in response.get('Contents', []) if obj['Key'].endswith('.mp4')]

    # if there is only one chunk, we may have the transcript for it from upload
    if len(chunk_files) == 1:
        transcript_path = commoncode.get_tag_value(bucket, s3_video_object_key, 'TranscriptS3Key', False)
        if transcript_path and 'assets/' in transcript_path:
            s3.copy_object(
                Bucket=bucket,
                CopySource={'Bucket': bucket, 'Key': transcript_path},
                Key=chunk_files[0].replace('.mp4', '.vtt')
            )

            return {
                'transcriptionComplete': all_complete,
                'chunks_processed': len(chunk_files)
            }

    chunk_files.append(s3_video_object_key)
    
    for chunk_file in chunk_files:
        print(f"Check {chunk_file}")
        # Extract chunk number from filename (e.g., chunk001.mp4 -> chunk001)
        chunk_name = chunk_file.split('/')[-1].replace('.mp4', '')
        job_name = f"{session_id}-{chunk_name}"
        
        # Check if transcription job exists
        transcription_job = get_transcription_job(job_name)
        
        if not transcription_job:
            output_key = chunk_file.replace('.mp4', '.vtt')
            if chunk_file == s3_video_object_key:
                output_key = commoncode.get_output_prefix(s3_video_object_key, 'transcription') + chunk_name
                commoncode.set_tag_value(bucket, chunk_file, 'TranscriptS3Key', output_key + '.vtt')

            # Submit for transcription
            submit_for_transcription(bucket, chunk_file, job_name, output_key)
            all_complete = False
        elif transcription_job.get('TranscriptionJob', {}).get('TranscriptionJobStatus') == 'COMPLETED':
            # Save transcription details but only for the main video asset to avoid
            # multiple transcription costs ruining the UI
            if chunk_file == s3_video_object_key:
                save_transcription_details(bucket, s3_video_object_key, transcription_job)
        elif transcription_job.get('TranscriptionJob', {}).get('TranscriptionJobStatus') == 'FAILED':
            # Transcribe job failed (e.g. no audio track, unparseable audio, silence-only)
            # Write an empty VTT so downstream steps can continue without a transcript
            failure_reason = transcription_job.get('TranscriptionJob', {}).get('FailureReason', 'Unknown')
            print(f"Transcription job {job_name} FAILED: {failure_reason}")

            output_key = chunk_file.replace('.mp4', '.vtt')
            if chunk_file == s3_video_object_key:
                output_key = commoncode.get_output_prefix(s3_video_object_key, 'transcription') + chunk_name + '.vtt'
                commoncode.set_tag_value(bucket, chunk_file, 'TranscriptS3Key', output_key)

            # Write an empty VTT subtitle file so the rest of the pipeline has something to read
            empty_vtt = "WEBVTT\n\nNOTE No transcript available - transcription failed: " + failure_reason + "\n"
            s3.put_object(Bucket=bucket, Key=output_key, Body=empty_vtt.encode('utf-8'), ContentType='text/vtt')
            print(f"Wrote empty VTT to s3://{bucket}/{output_key}")
        else:
            # Job exists but not complete
            all_complete = False
    
    return {
        'transcriptionComplete': all_complete,
        'chunks_processed': len(chunk_files)
    }

def submit_for_transcription(bucket, chunk_file, job_name, output_key):
    print(f"Submitting {chunk_file} for trancription")
    response = transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={
            'MediaFileUri': f's3://{bucket}/{chunk_file}'
        },
        MediaFormat='mp4',
        IdentifyLanguage=True,
        OutputBucketName=bucket,
        OutputKey=output_key.replace('.vtt', ''),
        Subtitles={
            'Formats': ['vtt']
        },
        Settings={
            'ShowSpeakerLabels': True,
            'MaxSpeakerLabels': 10
        }
    ) 

    return response

def save_transcription_details(bucket, s3_video_object_key, transcription_job):
    print("Saving transcription")
    if transcription_job and 'TranscriptionJob' in transcription_job:
        start_time = transcription_job['TranscriptionJob']['StartTime']
        completion_time = transcription_job['TranscriptionJob']['CompletionTime']
        processing_time = (completion_time - start_time).total_seconds()
        model_id = 'amazon.transcribe'

        video_duration_seconds = float(commoncode.get_tag_value(bucket, s3_video_object_key, 'DurationSeconds'))

        commoncode.save_statistics(
            commoncode.extract_session_from_object(bucket, s3_video_object_key),
            commoncode.extract_identity_from_path(s3_video_object_key),
            0,  # No input tokens for transcription
            0,  # No output tokens for transcription
            video_duration_seconds * TRANSCRIBE_PRICE_SECONDS,
            0,  # output cost always 0
            model_id,
            "Transcribe",
            processing_time,
            "Amazon",
            "Transcript",
            get_content_type(bucket, s3_video_object_key),
            video_duration_seconds # same duration as video
        )

        return True
    
    return False

def get_transcription_job(job_name):
    try:
        return transcribe.get_transcription_job(TranscriptionJobName=job_name)
    except Exception as e:
        return {}