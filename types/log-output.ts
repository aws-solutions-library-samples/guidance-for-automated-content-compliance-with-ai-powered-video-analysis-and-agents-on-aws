export interface ILogMessage extends ILogMessageRequest {
  createdAt: string;
  ttl: number;
  type?: 'info' | 'error' | 'warning';
}

export interface ILogMessageRequest {
  sessionId: string;
  identityId: string;
  message: string;
}

export interface ILogMessageQueryOptions {
  identityId: string;
  sessionId: string;
  limit?: number;
}