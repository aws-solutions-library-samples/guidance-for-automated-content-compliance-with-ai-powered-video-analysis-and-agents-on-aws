import json
from json_repair import repair_json

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
    
    # Get JSON string from request body - required parameter
    json_string = request_body.get("jsonString")
    print(f"JSON string to repair: {json_string}")
    
    # Validate required parameters
    if not json_string:
        return {
            "messageVersion": "1.0",
            "response": {
                "actionGroup": event["actionGroup"],
                "apiPath": event["apiPath"],
                "httpMethod": event["httpMethod"],
                "httpStatusCode": 400,
                "responseBody": {
                    "application/json": {
                        "body": json.dumps({"error": "jsonString is required"})
                    }
                }
            },
            "sessionAttributes": event["sessionAttributes"],
            "promptSessionAttributes": event["promptSessionAttributes"]
        }
    
    try:
        # Repair the JSON
        # Alternate way of calling, to return objects instead of string version
        # repaired_json = repair_json(json_string, skip_json_loads=True, return_objects=True)
        repaired_json = repair_json(json_string, skip_json_loads=True)
        
        result = {
            "repairedJson": repaired_json
        }
        
    except Exception as e:
        result = {
            "repairedJson": None,
            "errors": [str(e)]
        }
    
    print(f"Repair result: {json.dumps(result, indent=2)}")
    
    response_body = {"application/json": {"body": json.dumps(result)}}
    
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
