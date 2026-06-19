import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
The section below creates a database table.
=========================================================================*/
const schema = a.schema({
  JobStatus: a
    .model({
      sessionId: a.id().required(),
      userId: a.string().required(),
      createdAt: a.datetime().required(),
      executionTime: a.integer().required(),
      status: a.string().required(),
      message: a.string(),
      filename: a.string(),
    })
    .identifier(['sessionId', 'createdAt'])
    .secondaryIndexes((index) => [
      index('userId').sortKeys(['createdAt']),
    ])
    .authorization((allow) => [allow.authenticated().to(['read', 'create', 'update', 'delete'])]),

  LogOutput: a
    .model({
      sessionId: a.id().required(), // used for displaying log messages
      identityId: a.string().required(),
      message: a.string().required(),
      type: a.string(),
      createdAt: a.datetime().required(),
      ttl: a.integer().required(),
    })
    .identifier(['sessionId', 'createdAt'])
    .secondaryIndexes((index) => [
      index('identityId').sortKeys(['createdAt']),
      index('sessionId').sortKeys(['createdAt']),
    ])
    .authorization((allow) => [allow.authenticated().to(['read', 'create', 'delete'])]),

  VideoAnalysisResults: a
    .model({
      sessionId: a.id().required(),
      identityId: a.string().required(),
      s3VideoObjectKey: a.string(),
      s3TranscriptObjectKey: a.string(),
      s3OriginalFilename: a.string().required(),
      bedrockModelId: a.string().required(),
      prompt: a.string().required(),
      systemPrompt: a.string(),
      inferenceMaxTokens: a.integer(),
      inferenceTemperature: a.float(),
      inferenceTopP: a.float(),
      inferenceTopK: a.float(),
      usageOutputTokens: a.integer().required(),
      usageInputTokens: a.integer().required(),
      stopReason: a.string(),
      resultRaw: a.string().required(),
      contentType: a.string().required(),
      resultJSON: a.json(),
      rightsResultRaw: a.string(),
      qcResultRaw: a.string(),
      imdbResultRaw: a.string(),
      frameAnalysisFPS: a.integer(),
      frameAnalysisBedrockModelId: a.string(),
      frameAnalysisInferenceMaxTokens: a.integer(),
      frameAnalysisInferenceTemperature: a.float(),
      frameAnalysisInferenceTopK: a.float(),
      frameAnalysisInferenceTopP: a.float(),
      totalFrames: a.integer(), // total frames in the video
      framesToAnalyse: a.integer(), // phash reduces total frames to what needs to be analyzed
      framesAnalysed: a.integer(), // number of frames analyzed already
      bookmark: a.boolean(),
      workflowTime: a.float(), // total workflow time in seconds
      mimirItemId: a.string(), // Mimir item ID for push-to-Mimir integration
      createdAt: a.datetime().required(),
    })
    .identifier(['sessionId'])
    .secondaryIndexes((index) => [
      index('identityId').sortKeys(['createdAt'])
    ])
    .authorization((allow) => [allow.authenticated().to(['read', 'create', 'update', 'delete'])]),

  Statistics: a
    .model({
      sessionId: a.id().required(),
      identityId: a.string().required(),
      inputTokens: a.integer(),
      inputTokenCost: a.float(),
      outputTokens: a.integer(),
      outputTokenCost: a.float(),
      modelProvider: a.string(),
      modelId: a.string(),
      model: a.string(),
      duration: a.float(),
      processingTime: a.float(),
      processingType: a.string(),
      contentType: a.string(),
      createdAt: a.datetime().required(),
    })
    .identifier(['sessionId', 'createdAt'])
    .secondaryIndexes((index) => [
      index('sessionId').sortKeys(['createdAt']),
      index('identityId').sortKeys(['createdAt']),
      index('modelProvider').sortKeys(['createdAt']),
      index('modelId').sortKeys(['createdAt']),
    ])
    .authorization((allow) => [allow.authenticated().to(['read', 'create', 'delete'])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});