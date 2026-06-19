import { generateClient } from "aws-amplify/data";
import { type Schema } from "../resource";
import { type IJobStatus } from "../../../types/job-status";
import { JobStatusValues } from "../../global-variables";

const client = generateClient<Schema>();

export const listJobStatusByUser = async (userId: string): Promise<IJobStatus[]> => {
  try {
    const result = await client.models.JobStatus.list({
      filter: {
        userId: {
          eq: userId
        }
      },
      // sortDirection: 'DESC',
    });

    if(result.errors) {
      throw result.errors[0];
    } 

    return <IJobStatus[]>result.data.sort((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? -1 : 1);
  } catch (error) {
    console.error('Error listing job status:', error);
    throw error;
  }
};

export const createJobStatus = async (sessionId: string, userId: string, filename: string): Promise<IJobStatus> => {
  try {
    const result = await client.models.JobStatus.create({
      sessionId,
      userId,
      status: JobStatusValues.PENDING,
      executionTime: 0,
      createdAt: new Date().toISOString(),
      filename,
    });

    if(result.errors) {
      throw result.errors[0];
    }

    return <IJobStatus>result.data;
  } catch (error) {
    console.error('Error creating job status:', error);
    throw error;
  }
};