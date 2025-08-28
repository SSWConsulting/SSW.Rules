import { 
  GitHubSearchParams, 
  GitHubSearchResponse, 
  GitHubServiceConfig,
  GitHubPullRequest 
} from './github.types';
import { 
  GITHUB_API_BASE_URL, 
  GITHUB_PULL_REQUESTS_QUERY, 
  DEFAULT_RESULTS_PER_PAGE 
} from './github.constants';

export class GitHubService {
  private config: GitHubServiceConfig;

  constructor(config: GitHubServiceConfig) {
    this.config = config;
  }

  async searchPullRequestsByAuthor(
    author: string, 
    cursor?: string, 
    direction: 'after' | 'before' = 'after'
  ): Promise<GitHubSearchResponse> {
    const searchQuery = this.buildSearchQuery(author);
    const variables = this.buildSearchVariables(author, cursor, direction);

    const response = await fetch(GITHUB_API_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: GITHUB_PULL_REQUESTS_QUERY,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed with status: ${response.status}`
      );
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GitHub GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  private buildSearchQuery(author: string): string {
    return `repo:${this.config.owner}/${this.config.repo} is:pr base:${this.config.branch} is:merged sort:updated-desc author:${author}`;
  }

  private buildSearchVariables(
    author: string, 
    cursor?: string, 
    direction: 'after' | 'before' = 'after'
  ) {
    const variables: any = {
      query: this.buildSearchQuery(author),
      first: DEFAULT_RESULTS_PER_PAGE,
    };

    if (cursor) {
      if (direction === 'after') {
        variables.after = cursor;
      } else {
        variables.before = cursor;
      }
    }

    return variables;
  }

  /**
   * Get unique rules by name, keeping the most recent version
   */
  getUniqueRules(files: any[]) {
    const uniqueRulesMap = new Map();
    
    files.forEach(file => {
      const path = file.path;
      const ruleName = path.replace(/^rules\//, '').replace(/\/rule\.md$/, '');
      
      if (!uniqueRulesMap.has(ruleName) || 
          new Date(file.lastUpdated) > new Date(uniqueRulesMap.get(ruleName).lastUpdated)) {
        uniqueRulesMap.set(ruleName, file);
      }
    });

    return Array.from(uniqueRulesMap.values());
  }

  /**
   * Fetch GitHub username for a specific rule
   * @param ruleUri - The rule URI (e.g., "capture-contact-details-of-service-providers")
   * @param state - 0 for finding the creator, 1 for finding the last updater
   * @returns Promise<string> - The GitHub username
   */
  async fetchGitHubUsernameForRule(ruleUri: string, state: number = 1): Promise<string> {
    const filePath = `rules/${ruleUri}/rule.md`;
    const apiUrl = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/commits?path=${filePath}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `bearer ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed with status: ${response.status}`
      );
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error('No commits found for the specified file path');
    }

    // When state === 0, we want the creator (last commit in the array)
    // When state === 1, we want the last updater (first commit in the array)
    const commitIndex = state === 0 ? data.length - 1 : 0;
    const loginName = data[commitIndex]?.author?.login;

    if (!loginName) {
      throw new Error('Could not determine GitHub username from commit data');
    }

    return loginName;
  }
}

export function createGitHubService(): GitHubService {
  const owner = process.env.NEXT_PUBLIC_GITHUB_ORG || 'SSWConsulting';
  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO || 'SSW.Rules.Content';
  const branch = process.env.NEXT_PUBLIC_TINA_BRANCH || 'main';
  const token = process.env.NEXT_PUBLIC_GITHUB_API_PAT;

  if (!token) {
    throw new Error('GitHub API token is required. Set NEXT_PUBLIC_GITHUB_API_PAT environment variable.');
  }

  return new GitHubService({ owner, repo, branch, token });
}
