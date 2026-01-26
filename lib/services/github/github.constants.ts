export const GITHUB_API_BASE_URL = 'https://api.github.com/graphql';

export const GITHUB_PULL_REQUESTS_QUERY = `
  query SearchPullRequests($query: String!, $first: Int!, $after: String, $before: String) {
    search(
      query: $query
      type: ISSUE
      first: $first
      after: $after
      before: $before
    ) {
      pageInfo {
        endCursor
        startCursor
        hasNextPage
      }
      nodes {
        ... on PullRequest {
          files(first: 6) {
            nodes {
              path
            }
          }
          mergedAt
        }
      }
    }
  }
`;

export const DEFAULT_RESULTS_PER_PAGE = 6;
export const DEFAULT_FILES_PER_PULL_REQUEST = 20;

// Query for TinaCMS bot PRs - includes commit messages to extract co-authors
export const GITHUB_TINA_BOT_PRS_QUERY = `
  query SearchTinaBotPRs($query: String!, $first: Int!, $after: String) {
    search(
      query: $query
      type: ISSUE
      first: $first
      after: $after
    ) {
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        ... on PullRequest {
          number
          mergedAt
          files(first: 20) {
            nodes {
              path
            }
          }
          commits(first: 10) {
            nodes {
              commit {
                message
              }
            }
          }
        }
      }
    }
  }
`;
