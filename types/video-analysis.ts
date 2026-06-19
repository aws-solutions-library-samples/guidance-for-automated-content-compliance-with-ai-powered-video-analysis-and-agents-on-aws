import { BedrockAssetType, BedrockModelIds } from "../amplify/global-variables";

export interface IVideoAnalysisAssets {
    video: {
      s3ObjectOriginalFilename?: string;
      s3ObjectKey: string;
      type: BedrockAssetType.VIDEO
    },
    transcript?: {
      s3ObjectOriginalFilename?: string;
      s3ObjectKey: string;
      type: BedrockAssetType.DOCUMENT
    }
}

export interface IVideoAnalysisQueryOptions {
    identityId: string;
    s3ObjectKey?: string;
    limit?: number;
    bookmark?: boolean;
}

export interface IVideoAnalysisRequest {
    assets: IVideoAnalysisAssets;
    userId: string;
    identityId?: string;
    sessionId: string;
    prompt: string;
    systemPrompt?: string;
    bedrockModelId: BedrockModelIds;
    inferenceConfig: {
        maxTokens: number, 
        topP?: number, 
        temperature?: number,
        topK?: number
    },
}

export interface ICommonBedrockResult {
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        inputCost: number;
        outputCost: number;
    },
    output: {
        text: string;
    },
    stopReason: string;
}

export interface IVideoAnalysisResult {
    response: {
        error?: string;
        errorDetails?: string;
        result: ICommonBedrockResult, // response from Bedrock can vary by model
        resultJSON?: any,
        request: IVideoAnalysisRequest,
    }
}

export interface IVideoAnalysisHistoryResult {
    sessionId: string;
    identityId: string;
    readonly createdAt: string;
    s3VideoObjectKey?: string;
    s3TranscriptObjectKey?: string;
    s3OriginalFilename: string;
    bedrockModelId: string;
    prompt: string;
    systemPrompt?: string;
    resultRaw: string;
    resultJSON: string;
    rightsResultRaw: string;
    qcResultRaw: string;
    imdbResultRaw: string;
    inferenceMaxTokens?: number;
    inferenceTemperature?: number;
    inferenceTopP?: number;
    inferenceTopK?: number;
    usageOutputTokens?: number;
    usageInputTokens?: number;
    stopReason: string;
    bookmark: boolean;
    totalFrames?: number;
    framesToAnalyse?: number;
    framesAnalysed?: number;
    frameAnalysisFPS: number;
    frameAnalysisBedrockModelId?: string;
    frameAnalysisInferenceMaxTokens?: number;
    frameAnalysisInferenceTemperature?: number;
    frameAnalysisInferenceTopK?: number;
    frameAnalysisInferenceTopP?: number;
    workflowTime?: number;
    mimirItemId?: string;
}