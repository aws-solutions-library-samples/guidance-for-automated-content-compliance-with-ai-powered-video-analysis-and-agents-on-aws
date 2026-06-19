import { ILogMessage, ILogMessageQueryOptions } from '../types/log-output';
import { LogOutputQueries } from '../amplify/data/queries/log-output';
import { generateClient } from 'aws-amplify/api';
import { type Schema } from '../amplify/data/resource';

const dataClient = generateClient<Schema>();

export class LogOutputService {
  static async deleteLogOutputBySessionId(sessionId: string, identityId: string): Promise<void> {
    try {
      let nextToken: string | null = null;
      const deletePromises: Promise<any>[] = [];

      do {
        //@ts-ignore
        const messages = await dataClient.graphql({
          query: LogOutputQueries.listLogOutputBySessionIdAndCreatedAt,
          variables: {
            filter: { identityId: { eq: identityId } },
            sessionId: sessionId,
            sortDirection: 'ASC',
            ...(nextToken && { nextToken })
          }
        });

        //@ts-ignore
        const items = messages.data?.listLogOutputBySessionIdAndCreatedAt?.items || [];
        //@ts-ignore
        nextToken = messages.data?.listLogOutputBySessionIdAndCreatedAt?.nextToken;
        
        items.forEach((log: ILogMessage) => {
          deletePromises.push(
            dataClient.models.LogOutput.delete({
              sessionId: log.sessionId,
              createdAt: log.createdAt
            })
          );
        });
      } while (nextToken);
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }
    } catch (error) {
      console.error('Error deleting log output:', error);
      throw error;
    }
  };

  static async getRecentLogMessages (options: ILogMessageQueryOptions): Promise<ILogMessage[]> {
    try {
      let allMessages: ILogMessage[] = [];
      let nextToken: string | null = null;

      do {
        //@ts-ignore
        const request = {
          filter: {
            identityId: { eq: options.identityId },
          },
          limit: options.limit || 50,
          ...(nextToken && { nextToken })
        };

        //@ts-ignore
        const messages = await dataClient.graphql({
          query: LogOutputQueries.listLogOutputBySessionIdAndCreatedAt,
          variables: {
            filter: request.filter,
            limit: request.limit,
            identityId: options.identityId,
            sessionId: options.sessionId,
            sortDirection: 'ASC',
            ...(nextToken && { nextToken })
          }
        });

        //@ts-ignore
        if(!messages.data || !messages.data.listLogOutputBySessionIdAndCreatedAt) {
          throw new Error(`Error getting recent log messages: ${messages}`);
        }

        //@ts-ignore
        const items = messages.data.listLogOutputBySessionIdAndCreatedAt.items as ILogMessage[];
        //@ts-ignore
        nextToken = messages.data.listLogOutputBySessionIdAndCreatedAt.nextToken;
        
        if (items) {
          allMessages.push(...items);
        }
      } while (nextToken);
      
      return allMessages;
    } catch (error) {
      console.error('Error getting recent log messages:', error);
      throw error;
    }
  };
}