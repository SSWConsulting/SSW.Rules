import { GITHUB_API_BASE_URL, GITHUB_TINA_BOT_PRS_QUERY, GITHUB_PULL_REQUESTS_QUERY } from "./github.constants";
import { GitHubServiceConfig } from "./github.types";
import { getGitHubAppToken } from "./github.utils";

export class GitHubService {
  private config: GitHubServiceConfig;

  constructor(config: GitHubServiceConfig) {
    this.config = config;
  }

  async fetchWithRetry(url: string, options: any, maxRetries = 3, timeout = 15000): Promise<Response> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.status === 502 && attempt < maxRetries) {
          console.log(`[GitHub] 502 received, retrying in ${attempt * 1000}ms`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }

        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.log(`[GitHub] Request timed out on attempt ${attempt}`);
        } else {
          console.error(`[GitHub] Fetch error:`, error);
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        } else {
          throw error;
        }
      }
    }
    throw new Error(`Failed after ${maxRetries} attempts`);
  }

  async searchDirectPRs(username: string): Promise<any[]> {
    const query = `repo:${this.config.owner}/${this.config.repo} is:pr is:merged author:${username} sort:merged-desc`;
    const variables = { query, first: 50 };

    try {
      const response = await this.fetchWithRetry(GITHUB_API_BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `bearer ${this.config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: GITHUB_PULL_REQUESTS_QUERY, variables }),
      }, 2, 10000);

      if (!response.ok) throw new Error(`Direct PR search failed: ${response.status}`);

      const data = await response.json();
      return data.data?.search?.nodes || [];
    } catch (error) {
      console.error(`[GitHub] Direct PR search failed:`, error);
      return [];
    }
  }

  async searchTinaBotPRs(username: string, maxPages = 3): Promise<any[]> {
    const targetLower = username.toLowerCase();
    const allPRs: any[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < maxPages; page++) {
      try {
        // Simple query - just get Tina bot PRs
        const query = `repo:${this.config.owner}/${this.config.repo} is:pr is:merged author:tina-cloud-app[bot] sort:merged-desc`;
        const variables: any = { query, first: 30 };
        if (cursor) variables.after = cursor;

        const response = await this.fetchWithRetry(GITHUB_API_BASE_URL, {
          method: "POST",
          headers: {
            Authorization: `bearer ${this.config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: GITHUB_TINA_BOT_PRS_QUERY, variables }),
        }, 2, 10000);

        if (!response.ok) throw new Error(`Tina bot search failed: ${response.status}`);

        const data = await response.json();
        const nodes = data.data?.search?.nodes || [];
        const pageInfo = data.data?.search?.pageInfo || { hasNextPage: false };

        // Filter for co-authors by checking commit authors' GitHub login
        const filtered = nodes.filter((pr: any) => {
          if (!pr?.commits?.nodes) return false;

          for (const commit of pr.commits.nodes) {
            const authors = commit?.commit?.authors?.nodes || [];

            for (const author of authors) {
              const login = author?.user?.login?.toLowerCase() || '';
              const name = (author?.name || '').toLowerCase();
              const email = (author?.email || '').toLowerCase();

              if (login === targetLower || login.includes(targetLower) ||
                  email.includes(targetLower) || name.includes(targetLower)) {
                return true;
              }
            }

            // Fallback: also check commit message for co-authored-by lines
            const message = commit?.commit?.message || '';
            if (message.toLowerCase().includes(targetLower)) {
              return true;
            }
          }
          return false;
        });

        allPRs.push(...filtered);
        cursor = pageInfo?.endCursor;
        if (!pageInfo?.hasNextPage) break;

      } catch (error) {
        console.error(`[GitHub] Error fetching Tina bot PRs page ${page + 1}:`, error);
        break;
      }
    }

    return allPRs;
  }

  async getPRsForUser(username: string): Promise<any[]> {
    // Try multiple strategies in sequence
    const strategies = [
      () => this.searchTinaBotPRs(username),
      () => this.searchDirectPRs(username),
    ];

    let results: any[] = [];

    for (const strategy of strategies) {
      try {
        const prs = await strategy();
        results = [...results, ...prs];
        
        // If we found enough PRs, we can stop
        if (results.length >= 20) break;
      } catch (error) {
        console.error(`[GitHub] Strategy failed:`, error);
      }
    }

    // Remove duplicates
    const uniquePRs = results.filter((pr, index, self) =>
      index === self.findIndex(p => p.number === pr.number)
    );

    uniquePRs.sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime());
    return uniquePRs;
  }
}

export async function createGitHubService(): Promise<GitHubService> {
  const owner = process.env.NEXT_PUBLIC_GITHUB_ORG || "SSWConsulting";
  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO || "SSW.Rules.Content";
  const branch = "main";

  let token: string;
  try {
    token = await getGitHubAppToken();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get GitHub App token";
    throw new Error(
      `GitHub App authentication failed: ${errorMessage}. Please check that GH_APP_ID, GH_APP_PRIVATE_KEY, and optionally GITHUB_APP_INSTALLATION_ID are set correctly.`
    );
  }

  return new GitHubService({ owner, repo, branch, token });
}