import { generateClient } from 'aws-amplify/api';
import { type Schema } from '../amplify/data/resource';
import { IJobStatus } from '../types/job-status';
import { listJobStatusByUser, createJobStatus } from '@/amplify/data/queries/job-status';

const dataClient = generateClient<Schema>();

export class JobStatus {
  /**
   * Gets job statuses for a user
   */
  static async getJobStatusByUser(userId: string): Promise<IJobStatus[]> {
    try {
      return await listJobStatusByUser(userId);
    } catch (error) {
      console.error('Failed to get job statuses:', error);
      throw error;
    }
  }

  /**
   * Creates a new job status item in PENDING state
   */
  static async createJobStatus(sessionId: string, userId: string, filename: string): Promise<IJobStatus> {
    try {
      return await createJobStatus(sessionId, userId, filename);
    } catch (error) {
      console.error('Failed to create job status:', error);
      throw error;
    }
  }
}