import json
import re

def lambda_handler(event, context):
    """Lambda handler for QC Agent"""
    print(f"Received event: {json.dumps(event)}")
    
    # Debug: Print all top-level keys in the event
    print(f"Event keys: {list(event.keys())}")
    
    # Debug: Check if there's an inputText field that contains the prompt
    if "inputText" in event:
        print(f"InputText found: {event['inputText']}")

    # Extract parameters from Bedrock Agent event structure
    request_body = {}

    # Parse Bedrock Agent parameters from requestBody.content["application/json"]["properties"]
    if ("requestBody" in event and 
        "content" in event["requestBody"] and 
        "application/json" in event["requestBody"]["content"] and
        "properties" in event["requestBody"]["content"]["application/json"]):

        properties = event["requestBody"]["content"]["application/json"]["properties"]
        for prop in properties:
            if "name" in prop and "value" in prop:
                request_body[prop["name"]] = prop["value"]
        print(f"Parsed parameters from properties: {request_body}")

    # Get parameters from request body
    filename = request_body.get("filename")
    detected_language = request_body.get("detected_language", "EN-US")  # Default to English
    
    # Also try to extract detected language from the inputText if available
    input_text = event.get("inputText", "")
    if input_text and "Detected transcription language:" in input_text:
        # Extract language from input text like "Detected transcription language: IT-IT"
        match = re.search(r'Detected transcription language:\s*([A-Z]{2}-[A-Z]{2})', input_text)
        if match:
            detected_language_from_input = match.group(1)
            print(f"Extracted language from inputText: {detected_language_from_input}")
            detected_language = detected_language_from_input
    
    # Also try to extract detected language from the prompt text if available in request body
    prompt_text = request_body.get("prompt", "")
    if prompt_text and "Detected transcription language:" in prompt_text:
        # Extract language from prompt text like "Detected transcription language: IT-IT"
        match = re.search(r'Detected transcription language:\s*([A-Z]{2}-[A-Z]{2})', prompt_text)
        if match:
            detected_language_from_prompt = match.group(1)
            print(f"Extracted language from prompt: {detected_language_from_prompt}")
            detected_language = detected_language_from_prompt

    print(f"Final filename: {filename}")
    print(f"Final detected language: {detected_language}")

    # Validate required parameters
    if not filename:
        return {
            "messageVersion": "1.0",
            "response": {
                "actionGroup": event["actionGroup"],
                "apiPath": event["apiPath"],
                "httpMethod": event["httpMethod"],
                "httpStatusCode": 400,
                "responseBody": {
                    "application/json": {
                        "body": json.dumps({"error": "filename is required"})
                    }
                }
            },
            "sessionAttributes": event["sessionAttributes"],
            "promptSessionAttributes": event["promptSessionAttributes"]
        }

    # Validate language consistency
    qc_result = validate_language_consistency(filename, detected_language)
    print(f"QC validation result: {json.dumps(qc_result, indent=2)}")

    response_body = {"application/json": {"body": json.dumps(qc_result)}}

    action_response = {
        "actionGroup": event["actionGroup"],
        "apiPath": event["apiPath"],
        "httpMethod": event["httpMethod"],
        "httpStatusCode": 200,
        "responseBody": response_body,
    }

    session_attributes = event["sessionAttributes"]
    prompt_session_attributes = event["promptSessionAttributes"]

    return {
        "messageVersion": "1.0",
        "response": action_response,
        "sessionAttributes": session_attributes,
        "promptSessionAttributes": prompt_session_attributes,
    }

def validate_language_consistency(filename, detected_language):
    """Validate language consistency between filename and detected transcription language"""
    print(f"Starting language consistency validation for: {filename}")
    print(f"Detected transcription language: {detected_language}")

    # Extract language code from filename (or default to English)
    filename_language = extract_language_from_filename(filename)
    print(f"Filename language extracted: {filename_language}")

    # Determine validation method (always transcription)
    validation_method = determine_validation_method(filename_language)

    # Validate consistency between filename language and detected language
    return validate_consistency(filename_language, detected_language, filename, validation_method)

def extract_language_from_filename(filename):
    """Extract language code from filename - looks for 2 or 4 character codes at the end after underscore"""
    # Remove file extension for cleaner matching
    filename_base = filename.rsplit('.', 1)[0] if '.' in filename else filename

    # Pattern to match language codes at the end of filename after underscore
    # Matches 4-character codes (like jaJP, enUS) or 2-character codes (like EN, JA) at the end
    pattern = r'_([a-zA-Z]{2,4})$'

    match = re.search(pattern, filename_base, re.IGNORECASE)
    if match:
        lang = match.group(1).upper()
        # Normalize common formats
        if lang == 'JAJP':
            return 'JA-JP'
        elif lang == 'ENUS':
            return 'EN-US'
        elif lang == 'ENGB':
            return 'EN-GB'
        elif lang == 'JA':
            return 'JA-JP'
        elif lang == 'IT':
            return 'IT-IT'
        elif lang == 'EN':
            return 'EN-US'
        else:
            return lang

    # If no language code detected, default to English
    return 'EN-US'

def determine_validation_method(filename_language):
    """Determine validation method - always use transcription for language detection"""
    return 'transcription'  # Always validate against detected transcription language

def validate_consistency(filename_language, detected_language, filename, validation_method):
    """Validate language consistency between filename and detected transcription language"""
    issues = []
    qc_status = 'PASS'
    confidence = 85

    # Normalize languages for comparison
    normalized_filename = normalize_language_code(filename_language)
    normalized_detected = normalize_language_code(detected_language)

    # Main validation: compare filename language vs detected transcription language
    if normalized_filename != normalized_detected:
        issues.append(f'Language mismatch: filename language ({filename_language}) vs detected transcription language ({detected_language})')
        qc_status = 'FAIL'
        confidence = 90
    else:
        # Languages match
        issues.append(f'Language validation passed: filename language ({filename_language}) matches detected transcription language ({detected_language})')
        confidence = 95

    # Additional validation notes
    if filename_language == 'EN-US' and 'en' not in filename.lower():
        # File defaulted to English because no language code was found
        issues.append('No language code detected in filename - defaulted to English (EN-US)')
        if qc_status == 'PASS':
            qc_status = 'WARNING'
            confidence = 75

    # Content type specific checks
    if 'trailer' in filename.lower():
        if filename_language == 'EN-US' and 'en' not in filename.lower():
            issues.append('Trailer content should have explicit language coding in filename')
            if qc_status == 'PASS':
                qc_status = 'WARNING'

    if 'episode' in filename.lower():
        if filename_language == 'EN-US' and 'en' not in filename.lower():
            issues.append('Episodic content should have explicit language coding in filename')
            if qc_status == 'PASS':
                qc_status = 'WARNING'

    return {
        "qc_status": qc_status,
        "filename_language": filename_language,
        "content_language": detected_language,
        "validation_method": validation_method,
        "confidence": confidence,
        "issues": issues,
        "summary": generate_summary(qc_status, confidence, len(issues), validation_method),
        "recommendations": generate_recommendations(qc_status, issues, validation_method, filename_language, detected_language),
        "analysis_metadata": {
            "content_confidence": confidence,
            "filename_confidence": 85,
            "validation_source": get_validation_source_description(validation_method),
            "language_match": qc_status == 'PASS'
        }
    }

def normalize_language_code(code):
    """Normalize language code to base language"""
    if not code or code == 'UNKNOWN':
        return code

    base_code = code.split('-')[0].upper()
    mappings = {
        'JA': 'JA',
        'EN': 'EN',
        'ES': 'ES',
        'FR': 'FR',
        'IT': 'IT',
        'DE': 'DE'
    }
    return mappings.get(base_code, base_code)

def get_validation_source_description(validation_method):
    """Get human-readable description of validation source"""
    return 'Amazon Bedrock'

def generate_summary(status, confidence, issues_count, validation_method):
    """Generate summary message"""
    if status == 'PASS':
        return f"Language validation passed with {confidence}% confidence - filename language matches detected transcription language"
    elif status == 'FAIL':
        return f"Language validation failed - filename language does not match detected transcription language ({confidence}% confidence)"
    elif status == 'WARNING':
        return f"Language validation completed with warnings - {confidence}% confidence"
    else:
        return f"Language validation status: {status}"

def generate_recommendations(status, issues, validation_method, filename_language, detected_language):
    """Generate recommendations"""
    recommendations = []

    if status == 'FAIL':
        recommendations.extend([
            f'Update filename to include correct language code: {detected_language}',
            f'Verify transcription language detection is accurate',
            f'Current filename indicates {filename_language} but transcription detected {detected_language}',
            'Consider re-uploading file with correct language code in filename'
        ])
    elif status == 'WARNING':
        if 'defaulted to English' in ' '.join(issues):
            recommendations.extend([
                'Add explicit language code to filename (e.g., _enUS, _jaJP)',
                'Verify detected transcription language is correct',
                'Consider renaming file to include proper language identifier'
            ])
        else:
            recommendations.extend([
                'Review filename language coding standards',
                'Verify content language for distribution requirements'
            ])
    else:
        recommendations.append(f'Language validation passed - filename language ({filename_language}) correctly matches detected transcription language')

    # Specific recommendations based on content type
    if any('trailer' in issue.lower() for issue in issues):
        recommendations.append('Trailer files should follow naming convention: title_trailer_[LANG].ext')

    if any('episode' in issue.lower() for issue in issues):
        recommendations.append('Episode files should follow naming convention: title_s[X]e[Y]_[LANG].ext')

    return recommendations
