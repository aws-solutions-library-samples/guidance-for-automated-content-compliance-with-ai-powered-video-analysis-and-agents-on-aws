import boto3
import json
import os
import commoncode

def lambda_handler(event, context):
    """Lambda handler for IMDB Agent"""
    print(f"Received event: {json.dumps(event)}")

    # Extract parameters from Bedrock Agent event structure
    request_body = {}

    # Parse Bedrock Agent parameters - handle both formats
    if ("requestBody" in event and 
        "content" in event["requestBody"] and 
        "application/json" in event["requestBody"]["content"]):
        
        content = event["requestBody"]["content"]["application/json"]
        
        # Handle properties format
        if "properties" in content:
            properties = content["properties"]
            for prop in properties:
                if "name" in prop and "value" in prop:
                    request_body[prop["name"]] = prop["value"]
        # Handle direct JSON format
        else:
            request_body = content
            
        print(f"Parsed parameters: {request_body}")

    filename = request_body.get("filename")
    print(f"File Name: {filename}")
    compliance_analysis_result = request_body.get("compliance_analysis_result")

    # Validate IMDB information
    imdb_result = validate_imdb_data(filename, compliance_analysis_result)
    print(f"IMDB validation result: {json.dumps(imdb_result, indent=2)}")

    response_body = {"application/json": {"body": json.dumps(imdb_result)}}

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

def validate_imdb_data(filename, compliance_analysis_result):
    """
    Analyze IMDB Parents Guide validation for a given filename and compliance analysis
    
    Parameters:
    - filename: The filename to analyze
    - compliance_analysis_result: The compliance analysis results to validate
    
    Returns:
    - Dictionary containing IMDB Parents Guide validation results with cross-reference analysis
    """
    print("Starting IMDb validation...")
    
    # Load local files
    print("Loading local files...")
    parents_guide_data = load_local_files()

    # Parse files to extract IMDb information
    print("Parsing IMDb data...")
    all_imdb_data = commoncode.load_json(parents_guide_data) if isinstance(parents_guide_data, str) else parents_guide_data
    
    # Find matching entry by filename
    if filename and filename in all_imdb_data:
        imdb_result = all_imdb_data[filename]
        print(f"Found IMDB data for {filename}")
        
        # Enhance the result with cross-reference validation structure
        enhanced_result = {
            **imdb_result,
            "validation_metadata": {
                "filename": filename,
                "has_compliance_analysis": compliance_analysis_result is not None,
                "categories_with_content": [],
                "categories_without_content": [],
                "total_parent_guide_items": 0
            }
        }
        
        # Analyze each category for content presence
        categories_with_content = []
        categories_without_content = []
        total_items = 0
        
        for category_data in imdb_result.get("parentsGuide", []):
            category_name = category_data.get("category", "")
            severity = category_data.get("severity", "")
            items = category_data.get("parentsGuideItems", [])
            
            # Check if category has meaningful content
            has_content = False
            if severity and severity.strip():
                # Check if any parent guide items have non-empty text
                for item in items:
                    if item.get("text", "").strip():
                        has_content = True
                        total_items += 1
                        break
            
            if has_content:
                categories_with_content.append(category_name)
            else:
                categories_without_content.append(category_name)
        
        enhanced_result["validation_metadata"]["categories_with_content"] = categories_with_content
        enhanced_result["validation_metadata"]["categories_without_content"] = categories_without_content
        enhanced_result["validation_metadata"]["total_parent_guide_items"] = total_items
        
        # Add cross-reference analysis hints for the agent
        enhanced_result["cross_reference_hints"] = generate_cross_reference_hints(imdb_result, compliance_analysis_result)
        
        print(f"Enhanced IMDB result: {enhanced_result}")
        return enhanced_result
    else:
        # Return structured empty data if filename doesn't match
        print("No matching filename found, returning structured empty data")
        return {
            "title": "",
            "season": None,
            "episode": None,
            "imdb_id": "",
            "parentsGuide": [],
            "validation_metadata": {
                "filename": filename,
                "has_compliance_analysis": compliance_analysis_result is not None,
                "categories_with_content": [],
                "categories_without_content": ["Sex & Nudity", "Violence & Gore", "Profanity", "Alcohol, Drugs & Smoking", "Frightening & Intense Scenes"],
                "total_parent_guide_items": 0,
                "no_imdb_data": True
            }
        }  

def generate_cross_reference_hints(imdb_data, compliance_analysis):
    """
    Generate hints for cross-referencing IMDB data with compliance analysis
    
    Parameters:
    - imdb_data: IMDB parents guide data
    - compliance_analysis: Compliance analysis results
    
    Returns:
    - Dictionary with cross-reference hints for each category
    """
    hints = {}
    
    # Define category mappings between IMDB and compliance analysis
    category_mappings = {
        "Sex & Nudity": ["nudity", "sexual", "intimate", "adult content", "explicit"],
        "Violence & Gore": ["violence", "blood", "gore", "weapon", "fight", "death", "murder", "assault"],
        "Profanity": ["profanity", "language", "swearing", "curse", "explicit language", "strong language"],
        "Alcohol, Drugs & Smoking": ["alcohol", "drug", "smoking", "cigarette", "substance", "drinking", "intoxication"],
        "Frightening & Intense Scenes": ["frightening", "intense", "scary", "disturbing", "psychological", "horror", "suspense"]
    }
    
    for category_data in imdb_data.get("parentsGuide", []):
        category_name = category_data.get("category", "")
        severity = category_data.get("severity", "")
        items = category_data.get("parentsGuideItems", [])
        
        # Extract keywords from IMDB entries
        imdb_keywords = []
        for item in items:
            text = item.get("text", "").lower()
            if text.strip():
                imdb_keywords.extend(text.split())
        
        # Generate hints for this category
        hints[category_name] = {
            "severity": severity,
            "has_content": bool(severity and severity.strip() and any(item.get("text", "").strip() for item in items)),
            "imdb_keywords": list(set(imdb_keywords)),
            "search_terms": category_mappings.get(category_name, []),
            "item_count": len([item for item in items if item.get("text", "").strip()])
        }
    
    return hints

# This function should pull from an API
def load_local_files():
    """Load IMDb files"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    imdb_path = os.path.join(current_dir, 'imdb-parents-guide.json')
    with open(imdb_path, 'r', encoding='utf-8') as f:
        return f.read()