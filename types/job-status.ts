import { JobStatusValues } from "../amplify/global-variables";

export interface IJobStatus {
    sessionId: string;
    userId: string;
    createdAt: string;
    status: JobStatusValues;
    executionTime: number;
    message?: string;
    filename: string;
    readonly updatedAt: string;
}