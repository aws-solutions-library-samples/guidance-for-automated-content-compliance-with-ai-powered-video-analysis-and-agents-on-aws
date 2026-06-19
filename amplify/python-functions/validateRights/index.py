import boto3
import commoncode
import json

s3 = boto3.client('s3')

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
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
    
    # Get file name from request body - required parameter
    filename = request_body.get("filename")
    usage_type = request_body.get("usageType", "standard")
    print(f"Final File Name: {filename}, Usage Type: {usage_type}")
    
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
    
    # Validate rights based on filename
    rights_info = validate_asset_rights(filename, usage_type)
    print(f"Rights validation result: {json.dumps(rights_info, indent=2)}")
    
    response_body = {"application/json": {"body": json.dumps(rights_info)}}
    
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

def validate_asset_rights(filename, usage_type="standard"):
    """Validate rights for a specific filename"""
    print(f"Starting rights validation for asset: {filename}, usage: {usage_type}")
    
    # Load local files
    print("Loading local files...")
    file_data = load_local_files()
    
    # Parse files to extract rights information
    print("Parsing rights data...")
    result = parse_rights_data(file_data, filename, usage_type)
    print(f"Parse result: {json.dumps(result, indent=2)}")
    return result

def load_local_files():
    """Load MAM manifest and rights files"""
    import os
    
    # Get the directory where this lambda function is located
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Read MAM manifest file
    manifest_path = os.path.join(current_dir, 'mam-manifest.txt')
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest_content = f.read()
    
    # Read rights file
    rights_path = os.path.join(current_dir, 'rights.txt')
    with open(rights_path, 'r', encoding='utf-8') as f:
        rights_content = f.read()
    
    return {
        'manifest': manifest_content,
        'rights': rights_content
    }

def parse_rights_data(file_data, filename, usage_type):
    """Parse local files to extract rights information for a specific asset"""
    rights_info = file_data['rights']
    manifest_info = file_data['manifest']
    print(f"Parsing data for asset: {filename}")
    
    # Check if asset exists in manifest
    asset_verified = filename in manifest_info
    print(f"Asset verified in manifest: {asset_verified}")
    
    # Extract information for the specific asset
    asset_section = ""
    lines = rights_info.split('\n')
    in_asset_section = False
    
    for i, line in enumerate(lines):
        if f"File Name: {filename}" in line:
            print(f"Found asset at line {i}: {line}")
            in_asset_section = True
        elif line.startswith("=== ") and in_asset_section:
            print(f"End of asset section at line {i}: {line}")
            break
        elif in_asset_section:
            asset_section += line + "\n"
        
    # Parse asset information
    owner = extract_field(asset_section, "Owner:")
    clearance_status = extract_field(asset_section, "Clearance Status:")
    expiration_date = extract_field(asset_section, "Expiration Date:")
    restrictions = extract_field(asset_section, "Restrictions:")
    contacts = extract_field(asset_section, "Key Contacts:")
    territory_rights = extract_field(asset_section, "Territory Rights:")
    
    contacts_list = []
    if contacts:
        contacts_list = [c.strip() for c in contacts.split(' and ')]
    
    print(f"Parsed fields - Owner: {owner}, Status: {clearance_status}, Expiration: {expiration_date}")
    print(f"Restrictions: {restrictions}, Contacts: {contacts_list}")
    
    # Check if asset was found in rights database
    if not asset_section.strip():
        print(f"Asset {filename} not found in rights database")
        return {
            "filename": filename,
            "rights_status": "Not Found",
            "owner": "Unknown",
            "restrictions": ["Asset not found in rights database"],
            "error": f"Asset {filename} not found in rights database"
        }
    
    return {
        "asset_verified": asset_verified,
        "filename": filename,
        "rights_status": {
            "owner": owner or "Unknown",
            "clearance_status": clearance_status or "Unknown",
            "usage_permissions": [f"{usage_type.title()} usage"] if "Demo" in asset_section or usage_type.lower() in asset_section.lower() else [],
            "restrictions": [restrictions] if restrictions else [],
            "expiration_date": expiration_date or "",
            "territory_rights": territory_rights or "",
            "renewal_required": False
        },
        "contacts": {
            "primary_contact": contacts_list[0] if contacts_list else "",
            "additional_contacts": contacts_list[1:] if len(contacts_list) > 1 else []
        },
        "warnings": [] if asset_verified else ["Asset not found in MAM Manifest"],
        "recommendations": []
    }

def extract_field(text, field_name):
    """Extract field value from text"""
    for line in text.split('\n'):
        if field_name in line:
            return line.split(field_name)[1].strip()
    return None