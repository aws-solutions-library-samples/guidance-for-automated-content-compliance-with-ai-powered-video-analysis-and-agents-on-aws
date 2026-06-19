import { IVideoAnalysisHistoryResult } from '../types/video-analysis';
import { generateClient } from 'aws-amplify/api';
import { type Schema } from '../amplify/data/resource';
import { VideoAnalysisQueries } from '../amplify/data/queries/video-analysis';
import { IVideoAnalysisQueryOptions } from '../types/video-analysis';

const dataClient = generateClient<Schema>();

export class VideoAnalysisService {
  /**
   * Delete a video analysis and all related records
   * @param sessionId
   * @returns
   */
  static async deleteVideoAnalysis(sessionId: string): Promise<void> {
    try {
      const result = await dataClient.models.VideoAnalysisResults.delete({
        sessionId: sessionId
      });

      if(result.errors) {
        throw result.errors[0];
      }
    } catch (error) {
      console.error('Error deleting video analysis:', error);
      throw error;
    }
  };

  /**
   * Get a specific video analysis by id
   * @param id
   * @returns
   */
  static async getVideoAnalysisByJobId (sessionId: string): Promise<IVideoAnalysisHistoryResult> {
    try {
      //@ts-ignore
      const result = await dataClient.graphql({
        query: VideoAnalysisQueries.getVideoAnalysisResultsBySessionId,
        variables: { sessionId }
      });

      //@ts-ignore
      if (!result.data?.getVideoAnalysisResults) {
        throw new Error('No analysis results found');
      }

      //@ts-ignore
      return result.data.getVideoAnalysisResults as IVideoAnalysisHistoryResult;
    } catch (error) {
      console.error('Error listing analysis:', error);
      throw error;
    }
  };

  /**
   * Update bookmark status for a video analysis
   * @param sessionId
   * @param bookmark
   * @returns
   */
  static async updateVideoAnalysisBookmark(sessionId: string, bookmark: boolean): Promise<void> {
    try {
      const result = await dataClient.models.VideoAnalysisResults.update({
        sessionId: sessionId,
        bookmark: bookmark
      });

      if(result.errors) {
        throw result.errors[0];
      }
    } catch (error) {
      console.error('Error updating bookmark:', error);
      throw error;
    }
  };

  /**
   * Get recent video analysis for all videos per user, or a specific video per user
   * @param options 
   * @returns 
   */
  static async getRecentVideoAnalyses (options: IVideoAnalysisQueryOptions): Promise<IVideoAnalysisHistoryResult[]> {
    try {
      let allAnalyses: IVideoAnalysisHistoryResult[] = [];
      let nextToken: string | null = null;

      const filter: any = {};

      // Optional, only if we want to filter by specific video
      if(options.s3ObjectKey) {
        filter.s3ObjectKey = {
          eq: options.s3ObjectKey
        }
      }

      // Optional, only if we want to filter by bookmarks
      if(options.bookmark) {
        filter.bookmark = {
          eq: options.bookmark
        }
      }

      do {
        //@ts-ignore
        const analyses = await dataClient.graphql({
          query: VideoAnalysisQueries.listVideoAnalysisResultsByIdentityIdAndCreatedAt,
          variables: {
            filter: filter,
            limit: 5,
            identityId: options.identityId,
            sortDirection: 'DESC',
            ...(nextToken && { nextToken })
          }
        });

        //@ts-ignore
        if(!analyses.data || !analyses.data.listVideoAnalysisResultsByIdentityIdAndCreatedAt) {
          throw new Error(`Error getting recent video analysis: ${analyses}`);
        }

        //@ts-ignore
        const items = analyses.data.listVideoAnalysisResultsByIdentityIdAndCreatedAt.items as IVideoAnalysisHistoryResult[];
        //@ts-ignore
        nextToken = analyses.data.listVideoAnalysisResultsByIdentityIdAndCreatedAt.nextToken;
        
        if (items) {
          allAnalyses.push(...items);
        }
      } while (nextToken);
      
      return allAnalyses;
    } catch (error) {
      console.error('Error getting recent video analysis:', error);
      //@ts-ignore
      throw new Error(`Error getting recent video analysis: ${error.errors[0].message}`);
    }
  };
}