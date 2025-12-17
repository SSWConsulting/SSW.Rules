/**
 * GitHub History Utilities
 *
 * This module provides utilities for fetching and processing GitHub commit history,
 * including support for:
 * - Tracking file renames and migrations (rules/ -> public/uploads/rules/)
 * - Extracting co-authors from commit messages
 * - Filtering excluded commits and authors
 * - Finding alternate authors when primary author is excluded
 */

import { GitHubCommit } from "@/components/last-updated-by/types";
import { CommitDetails } from "./types";

// ---------------- Configuration ----------------

const CACHE_TTL = 3600; // 1 hour in seconds

/**
 * Commit SHAs to exclude from being shown as the latest commit
 * These commits will be skipped, and the next non-excluded commit will be shown instead
 */
export const EXCLUDED_COMMIT_SHAS: string[] = [
  "e6a4f720c383f7013fd009a0aa6b52e8fe779ee2",
  "0a57480c7730685582dd67f12d3e49a12ce0af32",
];

/**
 * Authors to exclude from being shown as the latest commit author
 * Commits by these authors (by GitHub login, name, or email) will be skipped
 * If a commit has co-authors, the first non-excluded co-author will be used instead
 */
export const EXCLUDED_AUTHORS: string[] = ["tina-cloud-app[bot]", "github-actions[bot]"];

// ---------------- API ----------------

export async function fetchGitHub<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    headers,
    next: { revalidate: CACHE_TTL },
  });

  if (response.status === 403 && response.headers.get("X-RateLimit-Remaining") === "0") {
    throw new Error("GitHub API rate limit exceeded");
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ---------------- Path Migration Support ----------------

function constructOldPath(path: string): string | null {
  const match = path.match(/^public\/(?:uploads\/)?rules\/(.+)$/);
  if (!match) return null;

  const relativePath = match[1];

  if (relativePath.endsWith("/rule.mdx")) {
    const oldPath = relativePath.replace(/\.mdx$/, ".md");
    return `rules/${oldPath}`;
  }

  return null;
}

// ---------------- Fetch All Commits ----------------

export async function fetchAllCommitsForPath(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  headers: Record<string, string>
): Promise<GitHubCommit[]> {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/commits`;
  const allCommits: GitHubCommit[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const params = new URLSearchParams({
      sha: branch,
      path,
      per_page: perPage.toString(),
      page: page.toString(),
    });

    try {
      const commits = await fetchGitHub<GitHubCommit[]>(`${baseUrl}?${params}`, headers);

      if (!commits || commits.length === 0) break;

      allCommits.push(...commits);

      if (commits.length < perPage) break;

      page++;
    } catch {
      break;
    }
  }

  return allCommits;
}

// ---------------- File History with Rename Tracking ----------------

/**
 * Merges two commit arrays, removing duplicates by SHA
 * @param currentCommits Current path commits (newest first)
 * @param additionalCommits Additional commits to merge (newest first)
 * @returns Merged commits array (newest first)
 */
function mergeCommits(currentCommits: GitHubCommit[], additionalCommits: GitHubCommit[]): GitHubCommit[] {
  const existingShas = new Set(currentCommits.map((c) => c.sha));
  const uniqueAdditional = additionalCommits.filter((c) => !existingShas.has(c.sha));
  return [...currentCommits, ...uniqueAdditional];
}

/**
 * Checks if a commit contains a rename operation for the given path
 * @param commitDetails Full commit details from GitHub API
 * @param currentPath The path we're tracking
 * @returns The previous filename if renamed, null otherwise
 */
function findRenameInCommit(commitDetails: CommitDetails, currentPath: string): string | null {
  const renamedFile = commitDetails.files?.find((file) => file.status === "renamed" && file.filename === currentPath && file.previous_filename);
  return renamedFile?.previous_filename || null;
}

/**
 * Finds the complete file history including:
 * - All commits for the current path
 * - Commits from the old path (if file was migrated from rules/ to public/uploads/rules/)
 * - Commits from any renamed paths found in commit history
 *
 * @param owner Repository owner
 * @param repo Repository name
 * @param path Current file path
 * @param branch Branch to search
 * @param headers GitHub API headers
 * @param visitedPaths Set of paths already visited (prevents infinite loops)
 * @returns Object containing all commits and the original path
 */
export async function findCompleteFileHistory(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  headers: Record<string, string>,
  visitedPaths: Set<string> = new Set()
): Promise<{ commits: GitHubCommit[]; originalPath: string }> {
  // Prevent infinite loops
  if (visitedPaths.has(path)) {
    return { commits: [], originalPath: path };
  }
  visitedPaths.add(path);

  // Fetch all commits for the current path
  const currentCommits = await fetchAllCommitsForPath(owner, repo, path, branch, headers);

  // Check if this is a migrated path (public/uploads/rules/... -> rules/...)
  const migratedOldPath = constructOldPath(path);
  if (migratedOldPath) {
    const oldPathCommits = await fetchAllCommitsForPath(owner, repo, migratedOldPath, branch, headers);
    const mergedCommits = mergeCommits(currentCommits, oldPathCommits);
    return {
      commits: mergedCommits,
      originalPath: migratedOldPath,
    };
  }

  // If no commits found, return early
  if (currentCommits.length === 0) {
    return { commits: [], originalPath: path };
  }

  // Search backwards through commits to find renames
  // We go from oldest to newest to find the earliest rename
  for (let i = currentCommits.length - 1; i >= 0; i--) {
    const commit = currentCommits[i];
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commit.sha}`;

    try {
      const commitDetails = await fetchGitHub<CommitDetails>(commitUrl, headers);
      const previousPath = findRenameInCommit(commitDetails, path);

      if (previousPath) {
        // File was renamed, recursively fetch history of the old path
        const oldPathHistory = await findCompleteFileHistory(owner, repo, previousPath, branch, headers, visitedPaths);

        const mergedCommits = mergeCommits(currentCommits, oldPathHistory.commits);
        return {
          commits: mergedCommits,
          originalPath: oldPathHistory.originalPath,
        };
      }
    } catch {
      // If we can't fetch commit details, continue to next commit
      continue;
    }
  }

  // No renames found, return commits for current path
  return { commits: currentCommits, originalPath: path };
}

// ---------------- Co-author Parsing ----------------

interface ExtractedCoAuthor {
  name: string;
  email: string;
}

/**
 * Extracts co-authors from commit message using "Co-authored-by:" trailers
 * @param message Commit message
 * @returns Array of co-author objects with name and email
 */
export function extractCoAuthors(message: string): ExtractedCoAuthor[] {
  const regex = /co-authored-by:\s*(.+?)\s*<([^>]+)>/gi;
  const coAuthors: ExtractedCoAuthor[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(message))) {
    coAuthors.push({
      name: match[1].trim(),
      email: match[2].trim(),
    });
  }

  return coAuthors;
}

// ---------------- Author Exclusion Helpers ----------------

/**
 * Normalizes an identifier (login, name, or email) for comparison
 * @param identifier The identifier to normalize
 * @returns Normalized identifier or null if not provided
 */
function normalizeIdentifier(identifier?: string | null): string | null {
  if (!identifier) return null;
  return identifier.trim().toLowerCase();
}

/**
 * Checks if an identifier (login, name, or email) is in the exclusion list
 * @param identifier The identifier to check
 * @returns true if the identifier is excluded
 */
function isIdentifierExcluded(identifier?: string | null): boolean {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return false;

  return EXCLUDED_AUTHORS.some((excluded) => normalizeIdentifier(excluded) === normalized);
}

/**
 * Checks if the primary author of a commit is excluded
 * @param commit The commit to check
 * @returns true if the primary author is excluded
 */
function isPrimaryAuthorExcluded(commit: GitHubCommit): boolean {
  return isIdentifierExcluded(commit.author?.login) || isIdentifierExcluded(commit.commit.author.name) || isIdentifierExcluded(commit.commit.author.email);
}

/**
 * Finds the first co-author that is not excluded
 * @param commit The commit to check
 * @returns The name of the first allowed co-author, or null if none found
 */
function findFirstAllowedCoAuthorName(commit: GitHubCommit): string | null {
  const coAuthors = extractCoAuthors(commit.commit.message);

  for (const coAuthor of coAuthors) {
    if (!isIdentifierExcluded(coAuthor.name) && !isIdentifierExcluded(coAuthor.email)) {
      return coAuthor.name;
    }
  }

  return null;
}

/**
 * Gets an alternate author name when the primary author is excluded
 * Returns the first non-excluded co-author name, or null if primary author is not excluded
 * @param commit The commit to check
 * @returns The alternate author name, or null
 */
export function getAlternateAuthorName(commit: GitHubCommit | null): string | null {
  if (!commit) {
    return null;
  }

  if (!isPrimaryAuthorExcluded(commit)) {
    return null;
  }

  return findFirstAllowedCoAuthorName(commit);
}

// ---------------- Commit Exclusion Logic ----------------

/**
 * Determines if a commit should be excluded based on SHA or author
 * A commit is excluded if:
 * - Its SHA is in the exclusion list, OR
 * - Its primary author is excluded AND it has no allowed co-authors
 *
 * @param commit The commit to check
 * @returns true if the commit should be excluded
 */
export function isCommitExcluded(commit: GitHubCommit): boolean {
  // Check if commit SHA is excluded
  if (EXCLUDED_COMMIT_SHAS.includes(commit.sha)) {
    return true;
  }

  // If primary author is not excluded, commit is allowed
  if (!isPrimaryAuthorExcluded(commit)) {
    return false;
  }

  // Primary author is excluded, but if any allowed co-author exists, don't exclude
  const alternateAuthorName = findFirstAllowedCoAuthorName(commit);
  return !alternateAuthorName;
}

// ---------------- Find Latest Valid Commit ----------------

export function findLatestNonExcludedCommit(commits: GitHubCommit[]): GitHubCommit | null {
  if (commits.length === 0) {
    return null;
  }

  for (const commit of commits) {
    if (!isCommitExcluded(commit)) {
      return commit;
    }
  }

  return commits[0];
}
