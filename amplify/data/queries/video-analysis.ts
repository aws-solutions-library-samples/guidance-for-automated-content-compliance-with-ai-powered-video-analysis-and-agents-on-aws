// Custom graphql queries
export class VideoAnalysisQueries {
    public static getVideoAnalysisResultsBySessionId = `
        query ($sessionId: ID!) {
            getVideoAnalysisResults(sessionId: $sessionId) {
                sessionId
                identityId
                s3VideoObjectKey
                s3TranscriptObjectKey
                s3OriginalFilename
                bedrockModelId
                prompt
                systemPrompt
                inferenceMaxTokens
                inferenceTemperature
                inferenceTopP
                inferenceTopK
                usageOutputTokens
                usageInputTokens
                stopReason
                resultRaw
                contentType
                resultJSON
                rightsResultRaw
                qcResultRaw
                imdbResultRaw
                bookmark
                frameAnalysisFPS
                frameAnalysisBedrockModelId
                frameAnalysisInferenceMaxTokens
                frameAnalysisInferenceTemperature
                frameAnalysisInferenceTopK
                frameAnalysisInferenceTopP
                totalFrames
                framesToAnalyse
                framesAnalysed
                workflowTime
                mimirItemId
                createdAt
                updatedAt
            }
        }
    `

    public static listVideoAnalysisResultsByIdentityIdAndCreatedAt = `
        query ($filter: ModelVideoAnalysisResultsFilterInput, $limit: Int, $nextToken: String, $sortDirection: ModelSortDirection, $identityId: String!, $createdAt: ModelStringKeyConditionInput) {
            listVideoAnalysisResultsByIdentityIdAndCreatedAt(filter: $filter, limit: $limit, nextToken: $nextToken, sortDirection: $sortDirection, identityId: $identityId, createdAt: $createdAt) {
              items {
                sessionId
                identityId
                s3VideoObjectKey
                s3TranscriptObjectKey
                s3OriginalFilename
                bedrockModelId
                prompt
                systemPrompt
                inferenceMaxTokens
                inferenceTemperature
                inferenceTopP
                inferenceTopK
                usageOutputTokens
                usageInputTokens
                stopReason
                resultRaw
                resultJSON
                rightsResultRaw
                qcResultRaw
                imdbResultRaw
                bookmark
                frameAnalysisFPS
                frameAnalysisBedrockModelId
                frameAnalysisInferenceMaxTokens
                frameAnalysisInferenceTemperature
                frameAnalysisInferenceTopK
                frameAnalysisInferenceTopP
                totalFrames
                framesToAnalyse
                framesAnalysed
                workflowTime
                mimirItemId
                createdAt
                updatedAt
              }
              nextToken
              __typename
            }
          }
    `
}