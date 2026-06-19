// Custom graphql queries
export class LogOutputQueries {
    public static listLogOutputBySessionIdAndCreatedAt = `
        query ($filter: ModelLogOutputFilterInput, $limit: Int, $nextToken: String, $sortDirection: ModelSortDirection, $sessionId: ID!, $createdAt: ModelStringKeyConditionInput) {
            listLogOutputBySessionIdAndCreatedAt(filter: $filter, limit: $limit, nextToken: $nextToken, sortDirection: $sortDirection, sessionId: $sessionId, createdAt: $createdAt) {
              items {
                sessionId
                identityId
                message
                type
                createdAt
              }
              nextToken
              __typename
            }
          }
    `
}