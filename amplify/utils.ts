import { v4 as uuidv4 } from 'uuid';
import { AmazonNovaAcceptedVideoFormat, AmazonNovaAcceptedTranscriptFormat } from "./global-variables";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";

const dynamoClient = new DynamoDBClient({});
const ssmClient = new SSMClient({});

let logOutputTable: string | undefined;

async function getLogOutputTable(): Promise<string | undefined> {
    if (logOutputTable) return logOutputTable;
    
    try {
        const response = await ssmClient.send(new GetParametersByPathCommand({
            Path: `/${process.env.AWS_BRANCH}/`,
            WithDecryption: true
        }));
        
        const logParam = response.Parameters?.find(p => p.Name?.endsWith('LOG_OUTPUT_TABLE'));
        logOutputTable = logParam?.Value;
        return logOutputTable;
    } catch (error) {
        console.error('Error getting LOG_OUTPUT_TABLE parameter:', error);
        return undefined;
    }
}

export class CommonUtils {
    static generateUUID() {
        return uuidv4();
    }
    
    static getDisplayFriendlyFileSize(value: number): string {
        return `${(value / 1024 / 1024).toFixed(2)} MB`;
    }

    static isVideoFormatSupported(type: string, filename: string) {
        return Object.values(AmazonNovaAcceptedVideoFormat)
            .includes(type.split('/').pop()?.toLowerCase() as AmazonNovaAcceptedVideoFormat)
            || Object.values(AmazonNovaAcceptedVideoFormat)
            .includes((filename.split('.').pop() as string) as AmazonNovaAcceptedVideoFormat);
    }

    static isTranscriptFormatSupported(type: string, filename: string) {
        return Object.values(AmazonNovaAcceptedTranscriptFormat)
            .includes(type.split('/').pop()?.toLowerCase() as AmazonNovaAcceptedTranscriptFormat) 
            || Object.values(AmazonNovaAcceptedTranscriptFormat)
            .includes((filename.split('.').pop() as string) as AmazonNovaAcceptedTranscriptFormat);
    }

    static getFileTypeOrExtension(filename: string, type?: string) {
        return type ? type : filename.split('.').pop() as string
    }

    static getBedrockFileFormatOrDefault(filename: string) {
        const fileExtension = filename.split('.').pop()?.toLowerCase() as string;

        if(fileExtension === '3gp') {
            return AmazonNovaAcceptedVideoFormat.THREE_GP;
        }

        //@ts-ignore
        const allAcceptedTypes = Object.values(AmazonNovaAcceptedVideoFormat).concat(Object.values(AmazonNovaAcceptedTranscriptFormat))
        const fileType = allAcceptedTypes.find((format) => format === fileExtension);

        if(fileType) {
            return fileType;
        } else {
            return fileExtension;
        }
    }

    static tryGetErrorFromBackend(error: any): string | undefined {
        try {
            const errorObj = JSON.parse(error._response.body);
            return `${errorObj.error}${errorObj.errorDetails ? ': ' + errorObj.errorDetails.substring(0, 100) : ''}`;
        } catch (e) {
            return undefined;
        }
    }

    static getUniqueResourceNameForEnv(name: string): string {
        return `${name}-${process.env.AWS_BRANCH}`;
    }

    static async logOutputMessage(sessionId: string, identityId: string, message: string, messageType: string = 'info'): Promise<void> {
        console.log(messageType, message);
        
        const tableName = await getLogOutputTable();
        if (!tableName) {
            console.log('LOG_OUTPUT_TABLE not set, skipping message logging');
            return;
        }
        
        try {
            const ttl = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
            const isoFormatZ = new Date().toISOString();
            
            await dynamoClient.send(new PutItemCommand({
                TableName: tableName,
                Item: {
                    sessionId: { S: sessionId },
                    identityId: { S: identityId },
                    message: { S: message },
                    type: { S: messageType },
                    createdAt: { S: isoFormatZ },
                    updatedAt: { S: isoFormatZ },
                    ttl: { N: ttl.toString() }
                }
            }));
        } catch (error) {
            console.error('Error logging output message:', error);
        }
    }
}