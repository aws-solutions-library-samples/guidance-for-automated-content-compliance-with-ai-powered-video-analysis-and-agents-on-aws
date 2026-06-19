import json
import boto3
import time
import re
import commoncode
from botocore.config import Config

bedrock_client = boto3.client('bedrock-runtime', config=Config(
    connect_timeout=900,
    read_timeout=900,
    retries={'max_attempts': 1}
))

s3_client = boto3.client('s3')

def analyse_profanity(bucket, s3_object_key):
    """
    Analyse transcript for profanity using Nova 2 Lite.
    Pre-parses VTT/SRT timestamps so the LLM only needs to identify profanity by line number.
    Returns a dict with profanity_events, token counts, processing_time, and note.
    Returns None on any failure.
    """
    # Get the transcript S3 key from the video object tags
    transcript_key = commoncode.get_tag_value(bucket, s3_object_key, 'TranscriptS3Key', should_exception=False)
    if not transcript_key:
        print("No TranscriptS3Key tag found, skipping profanity analysis")
        return None

    # Read transcript content from S3
    try:
        transcript_obj = s3_client.get_object(Bucket=bucket, Key=transcript_key)
        transcript_content = transcript_obj['Body'].read().decode('utf-8')
    except Exception as e:
        print(f"Error reading transcript from S3: {str(e)}")
        return None

    if not transcript_content.strip():
        print("Transcript content is empty, skipping profanity analysis")
        return None

    # Pre-parse timestamps from VTT/SRT format
    # Match patterns like "00:01:00.630 --> 00:01:01.669" or "00:01:00,630 --> 00:01:01,669"
    timestamp_pattern = re.compile(r'(\d{2}):(\d{2}):(\d{2})[.,]\d+\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d+')
    lines = transcript_content.split('\n')

    has_timestamps = False
    parsed_lines = []  # list of (start_seconds, text)
    current_timestamp = None

    for line in lines:
        line_stripped = line.strip()
        match = timestamp_pattern.search(line_stripped)
        if match:
            has_timestamps = True
            hours = int(match.group(1))
            minutes = int(match.group(2))
            seconds = int(match.group(3))
            current_timestamp = hours * 3600 + minutes * 60 + seconds
        elif line_stripped and current_timestamp is not None and not line_stripped.startswith('WEBVTT') and not line_stripped.isdigit():
            parsed_lines.append((current_timestamp, line_stripped))

    # If no timestamps found, treat as plain text
    note = None
    if not has_timestamps:
        note = "No timestamps found in transcript"
        # Send the raw transcript as plain text
        numbered_text = transcript_content
    else:
        # Build numbered lines with pre-computed timestamps for the LLM
        numbered_text = '\n'.join([f"[LINE {i}] (at {ts} seconds) {text}" for i, (ts, text) in enumerate(parsed_lines)])

    # Build the prompt for Nova 2 Lite
    prompt_text = f"""Analyze the following transcript lines for profanity, swear words, offensive language, and suggestive content.

You MUST answer in valid JSON format only. Only generate the JSON output. DO NOT provide any preamble, such as ```json.

Each line is prefixed with a LINE number and a timestamp in seconds. Use the LINE number in your response to identify which line contains flagged content.

## DETECTION GUIDELINES

### EXPLICIT PROFANITY
Flag clear profanity including:
- F-word, s-word, and similar strong language
- Hate speech or slurs of any kind
- Explicit sexual terminology
- "damn", "hell" (when used as profanity, not in a religious context)
- "crap" and other mild expletives or crude language

### SUGGESTIVE LANGUAGE & INNUENDO
Flag phrases with sexual double meanings or suggestive content:
- Euphemisms for body parts or sexual acts
- Double entendres with sexual connotations (e.g., "screwed someone")
- Phrases that sound innocent but have suggestive meanings in context
- References to adult establishments or activities
- Anatomical references used suggestively rather than medically

### CONTEXT ANALYSIS
- Consider the full sentence and surrounding dialogue
- Evaluate tone and intent (joking vs. serious)
- Look for puns or wordplay that create double meanings
- Consider if a phrase could be interpreted suggestively even if not explicitly offensive
- Pay attention to phrases that might be euphemisms or coded language

### DO NOT FLAG
- Medical or anatomical terms used in educational contexts
- Common everyday expressions without suggestive intent
- Partial words or words that merely sound similar

When in doubt about suggestive content, FLAG IT and note the potential double meaning.

## OUTPUT FORMAT

For each instance found, provide:
- line_number: the LINE number where the flagged content occurs
- word: the flagged word or phrase with surrounding context (include a few words before and after to give context, e.g. "Fu**ing watch me" instead of just "Fu**ing", or "shut the f**k up" instead of just "f**k")
- severity: one of "mild", "moderate", or "severe" (mild = crude language/innuendo, moderate = strong language/clear suggestive content, severe = slurs/hate speech/explicit sexual language)

Also indicate:
- profanity_detected: true if any flagged content was found, false otherwise

##JSON_SCHEMA##
{{
    "profanity_detected": false,
    "events": [
        {{
            "line_number": 0,
            "word": "",
            "severity": "mild"
        }}
    ]
}}
##JSON_SCHEMA##

##TRANSCRIPT##
{numbered_text}
##TRANSCRIPT##
"""

    request_body = {
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt_text}]
            }
        ],
        "inferenceConfig": {
            "maxTokens": 4096,
            "temperature": 0.1
        }
    }

    model_id = 'global.amazon.nova-2-lite-v1:0'

    try:
        start_time = time.time()

        response = bedrock_client.invoke_model(
            modelId=model_id,
            body=json.dumps(request_body),
            contentType="application/json"
        )

        processing_time = time.time() - start_time

        response_body = commoncode.load_json(response['body'].read())

        # Extract usage information
        usage = response_body.get('usage', {})
        input_tokens = usage.get('inputTokens', 0)
        output_tokens = usage.get('outputTokens', 0)

        # Parse the LLM output text
        llm_output = response_body['output']['message']['content'][0]['text']
        profanity_result = commoncode.load_json(llm_output)

        profanity_detected = profanity_result.get('profanity_detected', False)
        events = profanity_result.get('events', [])

        # If no profanity detected, return empty events
        if not profanity_detected:
            return {
                "profanity_events": [],
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "processing_time": processing_time,
                "note": None
            }

        # Build profanity events list, mapping line numbers back to pre-parsed timestamps
        profanity_events = []

        for event in events:
            line_number = event.get('line_number', 0)
            word = event.get('word', '')
            severity = event.get('severity', 'mild')

            # Validate severity
            if severity not in ('mild', 'moderate', 'severe'):
                severity = 'mild'

            # Look up the timestamp from our pre-parsed lines
            if has_timestamps and 0 <= line_number < len(parsed_lines):
                timestamp = parsed_lines[line_number][0]
            else:
                timestamp = 0

            profanity_events.append({
                "timestamp": timestamp,
                "word": word,
                "severity": severity
            })

        return {
            "profanity_events": profanity_events,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "processing_time": processing_time,
            "note": note
        }

    except Exception as e:
        print(f"Error during profanity analysis: {str(e)}")
        commoncode.log_output_message(bucket, s3_object_key, f"Error during profanity analysis: {str(e)}", "error")
        return None


def merge_profanity_into_report(report, profanity_result):
    """
    Merge profanity events into the existing timeline report structure.
    Adds a PROFANITY flag to the Detailed Analysis Flags section and
    merges profanity events into the Timeline section.
    """
    profanity_events = profanity_result.get('profanity_events', [])
    if not profanity_events:
        return report

    # Determine highest severity for the summary description
    severity_order = {'severe': 3, 'moderate': 2, 'mild': 1}
    highest_severity = max(profanity_events, key=lambda e: severity_order.get(e.get('severity', 'mild'), 0))
    highest_severity_label = highest_severity.get('severity', 'mild')

    severity_descriptions = {
        'severe': 'Severe profanity detected in transcript',
        'moderate': 'Moderate profanity detected in transcript',
        'mild': 'Mild profanity detected in transcript'
    }
    description = severity_descriptions.get(highest_severity_label, 'Profanity detected in transcript')

    # Add PROFANITY entry to Detailed Analysis Flags section
    for section in report.get('sections', []):
        if section.get('name') == 'Detailed Analysis Flags':
            section['subsections'].append({
                'name': 'PROFANITY',
                'detected': True,
                'description': description,
                'confidence': 100
            })
            break

    # Merge profanity events into Timeline section
    for section in report.get('sections', []):
        if section.get('name') == 'Timeline':
            timeline = section.get('subsections', [])

            for event in profanity_events:
                event_timestamp = event.get('timestamp', 0)
                profanity_flag = {'PROFANITY': event.get('word', '')}

                # Check if an existing timeline entry is within 1 second
                matched = False
                for entry in timeline:
                    if abs(entry.get('timestamp', 0) - event_timestamp) <= 1:
                        entry['flags'].append(profanity_flag)
                        matched = True
                        break

                if not matched:
                    timeline.append({
                        'name': format_timestamp(event_timestamp),
                        'timestamp': event_timestamp,
                        'frame': None,
                        'frame_analysis': None,
                        'flags': [profanity_flag]
                    })

            # Re-sort timeline by timestamp
            section['subsections'] = sorted(timeline, key=lambda e: e.get('timestamp', 0))
            break

    return report


def format_timestamp(timestamp):
    hours = int(timestamp / 3600)
    minutes = int((timestamp % 3600) / 60)
    seconds = int(timestamp % 60)
    formatted_time = f"{hours:02}:{minutes:02}:{seconds:02}"
    return formatted_time

def build_timeline_report(bucket, analysis_prefix, fps=1):
    top_level_flags = {}
    timeline = []
    done = False

    try:
        continuation_token = None
        
        while not done:
            if continuation_token:
                response = s3_client.list_objects_v2(
                    Bucket=bucket, 
                    Prefix=analysis_prefix,
                    ContinuationToken=continuation_token
                )
            else:
                response = s3_client.list_objects_v2(Bucket=bucket, Prefix=analysis_prefix)
            
            if 'Contents' in response:              
                for obj in response['Contents']:
                    if obj['Key'].endswith('_analysis.json'):
                        # Get analysis data
                        analysis_obj = s3_client.get_object(Bucket=bucket, Key=obj['Key'])
                        analysis_data = commoncode.load_json(analysis_obj['Body'].read())
                        
                        # Extract timestamp from filename
                        timestamp = commoncode.extract_timestamp(obj['Key'], fps)
                        
                        # Process compliance analysis
                        compliance_data = analysis_data.get('reponse', {})
                        sections = compliance_data.get('sections', [])
                        
                        frame_flags = []
        
                        for section in sections:
                            if section.get('name') == 'Content Moderation Flags':
                                for subsection in section.get('subsections', []):
                                    if subsection.get('detected'):
                                        frame_flags.append({
                                            subsection.get('name') : subsection.get('description')
                                        })

                                        if subsection.get('name') not in top_level_flags:
                                            top_level_flags[subsection.get('name')] = subsection

                                        if subsection.get('confidence') > top_level_flags[subsection.get('name')]['confidence']:
                                            top_level_flags[subsection.get('name')] = subsection
                        

                        if frame_flags:
                            if not timeline or json.dumps(frame_flags, sort_keys=True) != json.dumps(timeline[-1]['flags'], sort_keys=True):
                                timeline.append({
                                    "name" : format_timestamp(timestamp),
                                    "timestamp": timestamp,
                                    "frame": obj['Key'].replace('_analysis.json', '.jpg').replace('thumbnails_analysis', 'thumbnails'),
                                    "frame_analysis" : obj['Key'],
                                    "flags": frame_flags
                                })
            
            if response.get('IsTruncated'):
                continuation_token = response.get('NextContinuationToken')
            else:
                done = True

        return {
            'sections' : [
                {
                    'name' : 'Detailed Analysis Flags',
                    'subsections' : list(top_level_flags.values())
                },
                {
                    'name' : 'Timeline',
                    "subsections" : timeline
                }
            ]            
        }
        
    except Exception as e:
        print(f"Error building timeline report: {str(e)}")
        raise e

def lambda_handler(event, context):
    bucket = event.get('bucketName')
    s3_object_key = event.get('s3VideoObjectKey')
    thumbnails_prefix = commoncode.get_thumbnails_prefix(s3_object_key)

    analysis_prefix = thumbnails_prefix.replace('/thumbnails', '/thumbnails_analysis')
    report_path = analysis_prefix + 'detailed_analysis_report.json'
    fps = commoncode.get_fps(bucket, s3_object_key)

    report = build_timeline_report(bucket, analysis_prefix, fps)

    # Profanity analysis
    session_id = commoncode.extract_session_from_object(bucket, s3_object_key)
    identity_id = commoncode.extract_identity_from_path(s3_object_key)

    profanity_result = analyse_profanity(bucket, s3_object_key)
    if profanity_result is not None and len(profanity_result.get('profanity_events', [])) > 0:
        merge_profanity_into_report(report, profanity_result)

    # Save profanity statistics if analysis was performed
    if profanity_result is not None:
        profanity_model_id = 'global.amazon.nova-2-lite-v1:0'
        model_provider, model, input_token_cost, output_token_cost = commoncode.calculate_model_cost(
            profanity_model_id,
            profanity_result['input_tokens'],
            profanity_result['output_tokens']
        )
        commoncode.save_statistics(
            session_id=session_id,
            identity_id=identity_id,
            input_tokens=profanity_result['input_tokens'],
            output_tokens=profanity_result['output_tokens'],
            input_token_cost=input_token_cost,
            output_token_cost=output_token_cost,
            model_id=profanity_model_id,
            model=model,
            processing_time=profanity_result['processing_time'],
            model_provider=model_provider,
            processing_type='Profanity',
            content_type='Profanity',
            duration=0.0
        )

    s3_client.put_object(
        Bucket=bucket,
        Key=report_path,
        Body=json.dumps(report)
    )

    return {
        'detailedAnalysisReport' : report_path
    }