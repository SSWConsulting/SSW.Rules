import { GITHUB_API_BASE_URL, GITHUB_PULL_REQUESTS_QUERY, GITHUB_TINA_BOT_PRS_QUERY } from "./github.constants";
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

  async searchDirectPRs(username: string, targetCount = 50): Promise<any[]> {
    const allPRs: any[] = [];
    const seenPRNumbers = new Set<number>();
    let cursor: string | null = null;
    const maxPages = 20;

    for (let page = 0; page < maxPages; page++) {
      try {
        const query = `repo:${this.config.owner}/${this.config.repo} is:pr is:merged author:${username} sort:merged-desc`;
        const variables: any = { query, first: 50 };
        if (cursor) variables.after = cursor;

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
        const nodes = data.data?.search?.nodes || [];
        const pageInfo = data.data?.search?.pageInfo || { hasNextPage: false, endCursor: null };

        for (const pr of nodes) {
          if (pr?.number && !seenPRNumbers.has(pr.number)) {
            seenPRNumbers.add(pr.number);
            allPRs.push(pr);
          }
        }

        if (allPRs.length >= targetCount || !pageInfo.hasNextPage) break;
        cursor = pageInfo.endCursor;
      } catch (error) {
        console.error(`[GitHub] Direct PR search failed on page ${page}:`, error);
        break;
      }
    }

    return allPRs;
  }

  async fetchTinaBotPage(cursor: string | null): Promise<{ nodes: any[], pageInfo: any }> {
    const query = `repo:${this.config.owner}/${this.config.repo} is:pr is:merged author:tina-cloud-app[bot] sort:merged-desc`;
    const variables: any = { query, first: 100 };
    if (cursor) variables.after = cursor;

    const response = await this.fetchWithRetry(GITHUB_API_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: GITHUB_TINA_BOT_PRS_QUERY, variables }),
    }, 2, 15000);

    if (!response.ok) throw new Error(`Tina bot search failed: ${response.status}`);

    const data = await response.json();
    return {
      nodes: data.data?.search?.nodes || [],
      pageInfo: data.data?.search?.pageInfo || { hasNextPage: false, endCursor: null }
    };
  }

  async searchTinaBotPRs(username: string, targetCount = 20): Promise<any[]> {
    const targetLower = username.toLowerCase();
    const allPRs: any[] = [];
    const seenPRNumbers = new Set<number>();
    let cursor: string | null = null;

    // Keep fetching until we find enough PRs for this user or run out of pages
    while (true) {
      try {
        const { nodes, pageInfo } = await this.fetchTinaBotPage(cursor);

        // Filter for this user's PRs
        for (const pr of nodes) {
          if (!pr?.commits?.nodes || seenPRNumbers.has(pr.number)) continue;

          for (const commit of pr.commits.nodes) {
            const authors = commit?.commit?.authors?.nodes || [];
            let matched = false;

            for (const author of authors) {
              const login = author?.user?.login?.toLowerCase() || '';
              const name = (author?.name || '').toLowerCase();
              const email = (author?.email || '').toLowerCase();

              if (login === targetLower || login.includes(targetLower) ||
                  email.includes(targetLower) || name.includes(targetLower)) {
                matched = true;
                break;
              }
            }

            if (!matched) {
              const message = commit?.commit?.message || '';
              if (message.toLowerCase().includes(targetLower)) {
                matched = true;
              }
            }

            if (matched) {
              seenPRNumbers.add(pr.number);
              allPRs.push(pr);
              break;
            }
          }
        }

        // Stop if we have enough PRs for this user or no more pages
        if (allPRs.length >= targetCount || !pageInfo.hasNextPage) break;
        cursor = pageInfo.endCursor;

      } catch (error) {
        console.error(`[GitHub] Error fetching Tina bot PRs:`, error);
        break;
      }
    }

    return allPRs;
  }

  async searchPullRequestsByAuthor(author: string, cursor?: string, direction: "after" | "before" = "after"): Promise<any> {
    const query = `repo:${this.config.owner}/${this.config.repo} is:pr base:${this.config.branch} is:merged sort:updated-desc author:${author}`;
    const variables: any = { query, first: 6 };
    if (cursor) {
      if (direction === "after") {
        variables.after = cursor;
      } else {
        variables.before = cursor;
      }
    }

    const response = await fetch(GITHUB_API_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: GITHUB_PULL_REQUESTS_QUERY, variables }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed with status: ${response.status}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`GitHub GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  async getRuleAuthors(ruleUri: string): Promise<string[]> {
    const filePath = `rules/${ruleUri}/rule.md`;
    const apiUrl = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/commits?path=${filePath}`;

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `bearer ${this.config.token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed with status: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No commits found for the specified file path");
    }

    const chronological = [...data].reverse();
    const authors = chronological.map((c: any) => c?.author?.login).filter((login: any): login is string => Boolean(login));
    return authors;
  }

  async getPRsForUser(username: string): Promise<any[]> {
    // Run both searches in parallel - we need results from both
    const [tinaBotPRs, directPRs] = await Promise.all([
      this.searchTinaBotPRs(username).catch(err => {
        console.error(`[GitHub] Tina bot search failed:`, err);
        return [];
      }),
      this.searchDirectPRs(username).catch(err => {
        console.error(`[GitHub] Direct PR search failed:`, err);
        return [];
      }),
    ]);

    // Combine results
    const allPRs = [...tinaBotPRs, ...directPRs];

    // Remove duplicates
    const uniquePRs = allPRs.filter((pr, index, self) =>
      index === self.findIndex(p => p.number === pr.number)
    );

    // Sort by merge date (newest first)
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