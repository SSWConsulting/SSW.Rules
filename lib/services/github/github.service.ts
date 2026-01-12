import { DEFAULT_RESULTS_PER_PAGE, GITHUB_API_BASE_URL, GITHUB_PULL_REQUESTS_QUERY } from "./github.constants";
import { GitHubPullRequest, GitHubSearchParams, GitHubSearchResponse, GitHubServiceConfig } from "./github.types";
import { getGitHubAppToken } from "./github.utils";

export class GitHubService {
  private config: GitHubServiceConfig;

  constructor(config: GitHubServiceConfig) {
    this.config = config;
  }

  async searchPullRequestsByAuthor(author: string, cursor?: string, direction: "after" | "before" = "after"): Promise<GitHubSearchResponse> {
    const searchQuery = this.buildSearchQuery(author);
    const variables = this.buildSearchVariables(author, cursor, direction);

    const response = await fetch(GITHUB_API_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: GITHUB_PULL_REQUESTS_QUERY,
        variables,
      }),
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

  private buildSearchQuery(author: string): string {
    return `repo:${this.config.owner}/${this.config.repo} is:pr base:${this.config.branch} is:merged sort:updated-desc author:${author}`;
  }

  private buildSearchVariables(author: string, cursor?: string, direction: "after" | "before" = "after") {
    const variables: any = {
      query: this.buildSearchQuery(author),
      first: DEFAULT_RESULTS_PER_PAGE,
    };

    if (cursor) {
      if (direction === "after") {
        variables.after = cursor;
      } else {
        variables.before = cursor;
      }
    }

    return variables;
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

    // data is newest-first from GitHub; reverse to chronological oldest->newest
    const chronological = [...data].reverse();
    const authors = chronological.map((c: any) => c?.author?.login).filter((login: any): login is string => Boolean(login));
    return authors;
  }
}

export function getRuleCreatorFromAuthors(authors: string[]): string {
  const creator = Array.isArray(authors) ? authors[0] : undefined;
  if (!creator) throw new Error("No creator found from authors");
  return creator;
}

export function getRuleLastModifiedFromAuthors(authors: string[]): string {
  const last = Array.isArray(authors) ? authors[authors.length - 1] : undefined;
  if (!last) throw new Error("No last modified author found from authors");
  return last;
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
