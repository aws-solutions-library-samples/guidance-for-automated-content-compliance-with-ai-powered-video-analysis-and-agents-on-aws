import { generateClient } from "aws-amplify/data";
import { type Schema } from "../resource";
import { type IStatistic } from "../../../types/statistic";

const client = generateClient<Schema>();

// Custom graphql queries
export class StatisticsQueries {
    public static listStatisticsBySessionIdAndCreatedAt = `
        query ($filter: ModelStatisticsFilterInput, $limit: Int, $nextToken: String, $sortDirection: ModelSortDirection, $sessionId: ID!, $createdAt: ModelStringKeyConditionInput) {
            listStatisticsBySessionIdAndCreatedAt(filter: $filter, limit: $limit, nextToken: $nextToken, sortDirection: $sortDirection, sessionId: $sessionId, createdAt: $createdAt) {
              items {
                sessionId
                identityId
                inputTokens
                inputTokenCost
                outputTokens
                outputTokenCost
                modelProvider
                modelId
                model
                duration
                processingTime
                processingType
                contentType
                createdAt
              }
              nextToken
              __typename
            }
          }
    `

    public static listStatisticsByIdentityIdAndCreatedAt = `
        query ($filter: ModelStatisticsFilterInput, $limit: Int, $nextToken: String, $sortDirection: ModelSortDirection, $identityId: String!, $createdAt: ModelStringKeyConditionInput) {
            listStatisticsByIdentityIdAndCreatedAt(filter: $filter, limit: $limit, nextToken: $nextToken, sortDirection: $sortDirection, identityId: $identityId, createdAt: $createdAt) {
              items {
                sessionId
                identityId
                inputTokens
                inputTokenCost
                outputTokens
                outputTokenCost
                modelProvider
                modelId
                model
                duration
                processingTime
                processingType
                contentType
                createdAt
              }
              nextToken
              __typename
            }
          }
    `
}