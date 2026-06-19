export interface IStatistic {
  sessionId: string;
  identityId: string;
  inputTokens?: number;
  inputTokenCost?: number;
  outputTokens?: number;
  outputTokenCost?: number;
  modelProvider?: string;
  modelId?: string;
  model?: string;
  duration?: number;
  processingTime?: number;
  processingType?: string;
  contentType?: string;
  createdAt: string;
}