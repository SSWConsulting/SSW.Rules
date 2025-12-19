import { NextResponse } from "next/server";
import type { GitHubCommit } from "@/components/last-updated-by/types";
import { fetchGitHub, findCompleteFileHistory, findLatestNonExcludedCommit, getAlternateAuthorName } from "./util";

const GITHUB_ACTIVE_BRANCH = process.env.NEXT_PUBLIC_TINA_BRANCH || "main";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path")?.replace(/\\/g, "/");

  if (!owner || !repo) {
    return NextResponse.json({ error: "Missing owner or repo parameters" }, { status: 400 });
  }

  const githubToken = process.env.GITHUB_API_PAT;

  if (!githubToken) {
    return NextResponse.json({ error: "GitHub API token is not configured" }, { status: 500 });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Rules.V3",
    Authorization: `Bearer ${githubToken}`,
  };

  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/commits`;
  const params = new URLSearchParams({
    sha: GITHUB_ACTIVE_BRANCH,
    per_page: "1",
  });
  if (path) {
    params.append("path", path);
  }

  try {
    if (path) {
      // Fetch complete file history including migrated paths and renames
      const { commits: allCommitsWithHistory } = await findCompleteFileHistory(owner, repo, path, GITHUB_ACTIVE_BRANCH, headers);

      if (!allCommitsWithHistory.length) {
        return NextResponse.json({ error: "No commits found", branch: GITHUB_ACTIVE_BRANCH }, { status: 400 });
      }

      // Find the latest non-excluded commit (newest first)
      const latestCommit = findLatestNonExcludedCommit(allCommitsWithHistory);
      // Find the first commit (oldest, last in array since it's newest-first)
      const firstCommit = allCommitsWithHistory[allCommitsWithHistory.length - 1];

      if (!latestCommit) {
        return NextResponse.json({ error: "No valid commits found" }, { status: 400 });
      }

      return NextResponse.json({
        latestCommit,
        firstCommit,
        historyUrl: `https://github.com/${owner}/${repo}/commits/${GITHUB_ACTIVE_BRANCH}/${path}`,
        otherCoAuthorName: getAlternateAuthorName(latestCommit),
      });
    } else {
      // No path specified, just get latest commit for the branch
      const latestCommits = await fetchGitHub<GitHubCommit[]>(`${baseUrl}?${params}`, headers);

      if (!latestCommits.length) {
        return NextResponse.json({ error: "No commits found" }, { status: 400 });
      }

      const latestCommit = findLatestNonExcludedCommit(latestCommits);

      if (!latestCommit) {
        return NextResponse.json({ error: "No valid commits found" }, { status: 400 });
      }

      return NextResponse.json({
        latestCommit,
        firstCommit: null,
        historyUrl: `https://github.com/${owner}/${repo}/commits/${GITHUB_ACTIVE_BRANCH}`,
        otherCoAuthorName: getAlternateAuthorName(latestCommit),
      });
    }
  } catch (error) {
    console.error("Error fetching GitHub metadata:", error);
    return NextResponse.json({ error: "Failed to fetch GitHub metadata" }, { status: 500 });
  }
}
