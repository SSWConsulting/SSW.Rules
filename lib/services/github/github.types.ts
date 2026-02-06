export interface GitHubFile {
  path: string;
}

export interface GitHubPullRequest {
  number: number;
  mergedAt: string;
  files: {
    nodes: GitHubFile[];
  };
}

export interface GitHubPageInfo {
  endCursor: string;
  startCursor: string;
  hasNextPage: boolean;
}

export interface GitHubSearchResponse {
  search: {
    pageInfo: GitHubPageInfo;
    nodes: GitHubPullRequest[];
  };
}

export interface GitHubSearchParams {
  owner: string;
  repo: string;
  branch: string;
  author: string;
  first: number;
  cursor?: string;
}

export interface GitHubServiceConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}
