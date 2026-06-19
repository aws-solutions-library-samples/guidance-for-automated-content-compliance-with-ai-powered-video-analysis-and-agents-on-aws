import { IStatistic } from '../types/statistic';
import { StatisticsQueries } from '../amplify/data/queries/statistics';
import { generateClient } from 'aws-amplify/api';
import { type Schema } from '../amplify/data/resource';
import { ProcessingType } from '../amplify/global-variables';

const dataClient = generateClient<Schema>();

export class StatisticsService {
  static async getStatisticsByIdentityId(identityId: string): Promise<IStatistic[]> {
    try {
      let allStats: IStatistic[] = [];
      let nextToken: string | null = null;

      do {
        //@ts-ignore
        const statistics = await dataClient.graphql({
          query: StatisticsQueries.listStatisticsByIdentityIdAndCreatedAt,
          variables: {
            identityId: identityId,
            sortDirection: 'DESC',
            ...(nextToken && { nextToken })
          }
        });

        //@ts-ignore
        if (!statistics.data || !statistics.data.listStatisticsByIdentityIdAndCreatedAt) {
          throw new Error(`Error getting statistics: ${statistics}`);
        }

        //@ts-ignore
        const items = statistics.data.listStatisticsByIdentityIdAndCreatedAt.items as IStatistic[];
        //@ts-ignore
        nextToken = statistics.data.listStatisticsByIdentityIdAndCreatedAt.nextToken;
        
        if (items) {
          allStats.push(...items);
        }
      } while (nextToken);
      
      return allStats;
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  }

  static async getStatisticsBySessionId(sessionId: string): Promise<IStatistic[]> {
    try {
      let allStats: IStatistic[] = [];
      let nextToken: string | null = null;

      do {
        //@ts-ignore
        const statistics = await dataClient.graphql({
          query: StatisticsQueries.listStatisticsBySessionIdAndCreatedAt,
          variables: {
            sessionId: sessionId,
            sortDirection: 'DESC',
            ...(nextToken && { nextToken })
          }
        });

        //@ts-ignore
        if (!statistics.data || !statistics.data.listStatisticsBySessionIdAndCreatedAt) {
          throw new Error(`Error getting statistics: ${statistics}`);
        }

        //@ts-ignore
        const items = statistics.data.listStatisticsBySessionIdAndCreatedAt.items as IStatistic[];
        //@ts-ignore
        nextToken = statistics.data.listStatisticsBySessionIdAndCreatedAt.nextToken;
        
        if (items) {
          allStats.push(...items);
        }
      } while (nextToken);
      
      return allStats;
    } catch (error) {
      console.error('Error getting statistics by session ID:', error);
      throw error;
    }
  }

  static async getAllStatistics(): Promise<Record<string, IStatistic[]>> {
    try {
      let allStats: IStatistic[] = [];
      let nextToken: string | null = null;

      do {
        //@ts-ignore
        const statistics = await dataClient.models.Statistics.list({
          ...(nextToken && { nextToken })
        });

        if (!statistics.data) {
          throw new Error(`Error getting statistics: ${statistics}`);
        }

        const items = statistics.data as IStatistic[];
        nextToken = statistics.nextToken;
        
        if (items) {
          allStats.push(...items);
        }
      } while (nextToken);
      
      // Group by content type using ProcessingType enum values
      const groupedStats: Record<string, IStatistic[]> = {
        [ProcessingType.VIDEO]: [],
        [ProcessingType.FRAME]: [],
        [ProcessingType.TRANSCRIPT]: [],
        [ProcessingType.AGENT]: []
      };

      allStats.forEach(stat => {
        const contentType = stat.processingType || 'Unknown';
        if (!groupedStats[contentType]) {
          groupedStats[contentType] = [];
        }
        groupedStats[contentType].push(stat);
      });

      return groupedStats;
    } catch (error) {
      console.error('Error getting all statistics:', error);
      throw error;
    }
  }
}