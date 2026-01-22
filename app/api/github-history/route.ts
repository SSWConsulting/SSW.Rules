import { NextResponse } from "next/server";
import type { GitHubCommit } from "@/components/last-updated-by/types";
import { getGitHubAppToken } from "@/lib/services/github/github.utils";
import { fetchGitHub, findCompleteFileHistory, findLatestNonExcludedCommit, getAlternateAuthorName } from "./util";

const GITHUB_ACTIVE_BRANCH = process.env.NEXT_PUBLIC_TINA_BRANCH || "main";
const CACHE_TTL = 3600;
const MAX_PATHS = 50;
const CONCURRENCY = 5;

type Mode = "updated" | "created";

type BatchRequestBody = {
  mode?: Mode;
  ref?: string; // optional override branch
  paths: string[];
};

type BatchResultItem =
  | {
      path: string;
      authorName: string | null;
      sha: string | null;
      date: string | null;
      historyUrl: string;
    }
  | {
      path: string;
      error: string;
      historyUrl: string;
    };

// --- Route-level in-memory cache (per path) ---
type CacheEntry = { expiresAt: number; value: BatchResultItem };
const routeCache = new Map<string, CacheEntry>();

function cacheKey(mode: Mode, ref: string, path: string) {
  return `${mode}::${ref}::${path}`;
}

function cacheGet(key: string): BatchResultItem | null {
  const hit = routeCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    routeCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: BatchResultItem) {
  routeCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL * 1000 });
}

function normalizePath(path: string | null | undefined) {
  if (!path) return null;
  return path.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function buildHistoryUrl(owner: string, repo: string, branch: string, path?: string | null) {
  return path ? `https://github.com/${owner}/${repo}/commits/${branch}/${path}` : `https://github.com/${owner}/${repo}/commits/${branch}`;
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const iterator = items.entries();

  async function worker() {
    for (const [index, item] of iterator) {
      results[index] = await fn(item, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

/**
 * Decide which author name to return based on your existing exclusion rules:
 * - if commit is excluded by author/bot but has allowed co-author => util returns that name via getAlternateAuthorName
 * - if excluded and no allowed co-author => return null
 * - if not excluded => return primary author name (commit.commit.author.name)
 */
function pickAuthorNameOrNull(commit: GitHubCommit | null): string | null {
  if (!commit) return null;

  const alt = getAlternateAuthorName(commit);
  if (alt) return alt;

  const primaryName = commit.commit?.author?.name ?? null;
  return primaryName;
}

// ---------------- GET (keep existing behavior) ----------------
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path")?.replace(/\\/g, "/");

  if (!owner || !repo) {
    return NextResponse.json({ error: "Missing owner or repo parameters" }, { status: 400 });
  }

  // Construct historyUrl that will always be returned (even on errors)
  const historyUrl = path
    ? `https://github.com/${owner}/${repo}/commits/${GITHUB_ACTIVE_BRANCH}/${path}`
    : `https://github.com/${owner}/${repo}/commits/${GITHUB_ACTIVE_BRANCH}`;

  let githubToken: string;
  try {
    githubToken = await getGitHubAppToken();
  } catch (error) {
    // Log error for debugging
    console.error("GitHub App authentication error:", {
      message: error instanceof Error ? error.message : "Failed to get GitHub App token",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Always return historyUrl even on authentication error
    return NextResponse.json(
      {
        error: "GitHub App authentication failed",
        historyUrl,
      },
      { status: 500 }
    );
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
        return NextResponse.json({ error: "No commits found", branch: GITHUB_ACTIVE_BRANCH, historyUrl }, { status: 400 });
      }

      // Find the latest non-excluded commit (newest first)
      const latestCommit = findLatestNonExcludedCommit(allCommitsWithHistory);
      // Find the first commit (oldest, last in array since it's newest-first)
      const firstCommit = allCommitsWithHistory[allCommitsWithHistory.length - 1];

      if (!latestCommit) {
        return NextResponse.json({ error: "No valid commits found", historyUrl }, { status: 400 });
      }

      return NextResponse.json({
        latestCommit,
        firstCommit,
        historyUrl,
        otherCoAuthorName: getAlternateAuthorName(latestCommit),
      });
    } else {
      // No path specified, just get latest commit for the branch
      const latestCommits = await fetchGitHub<GitHubCommit[]>(`${baseUrl}?${params}`, headers);

      if (!latestCommits.length) {
        return NextResponse.json({ error: "No commits found", historyUrl }, { status: 400 });
      }

      const latestCommit = findLatestNonExcludedCommit(latestCommits);

      if (!latestCommit) {
        return NextResponse.json({ error: "No valid commits found", historyUrl }, { status: 400 });
      }

      return NextResponse.json({
        latestCommit,
        firstCommit: null,
        historyUrl,
        otherCoAuthorName: getAlternateAuthorName(latestCommit),
      });
    }
  } catch (error) {
    console.error("Error fetching GitHub metadata:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch GitHub metadata";
    return NextResponse.json({ error: errorMessage, historyUrl }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const owner = process.env.NEXT_PUBLIC_GITHUB_ORG;
  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;

  if (!owner || !repo) {
    return NextResponse.json({ error: "Missing owner or repo parameters" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as BatchRequestBody | null;
  if (!body || !Array.isArray(body.paths)) {
    return NextResponse.json({ error: "Invalid JSON body. Expected { paths: string[], mode?: 'updated'|'created', ref?: string }" }, { status: 400 });
  }

  const mode: Mode = body.mode === "created" ? "created" : "updated";
  const ref = (body.ref && body.ref.trim()) || GITHUB_ACTIVE_BRANCH;

  const normalizedPaths = body.paths.map((p) => normalizePath(p)).filter(Boolean) as string[];

  if (normalizedPaths.length === 0) {
    return NextResponse.json({ error: "No valid paths provided" }, { status: 400 });
  }
  if (normalizedPaths.length > MAX_PATHS) {
    return NextResponse.json({ error: `Too many paths. Max ${MAX_PATHS}` }, { status: 400 });
  }

  let githubToken: string;
  try {
    githubToken = await getGitHubAppToken();
  } catch (error) {
    return NextResponse.json(
      {
        error: "GitHub App authentication failed",
      },
      { status: 500 }
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Rules.V3",
    Authorization: `Bearer ${githubToken}`,
  };

  const results: BatchResultItem[] = new Array(normalizedPaths.length);

  let cacheHits = 0;
  const missList: Array<{ index: number; path: string }> = [];

  normalizedPaths.forEach((path, index) => {
    const key = cacheKey(mode, ref, path);
    const cached = cacheGet(key);
    if (cached) {
      results[index] = cached;
      cacheHits++;
    } else {
      missList.push({ index, path });
    }
  });

  const batchSize = 10; // Define batch size to limit API calls
  const computed: Array<{ index: number; item: BatchResultItem }> = [];

  for (let i = 0; i < missList.length; i += batchSize) {
    const batch = missList.slice(i, i + batchSize);

    const batchResults = await runWithConcurrency(batch, CONCURRENCY, async ({ index, path }): Promise<{ index: number; item: BatchResultItem }> => {
      const historyUrl = buildHistoryUrl(owner, repo, ref, path);

      try {
        const { commits: allCommitsWithHistory } = await findCompleteFileHistory(owner, repo, path, ref, headers);

        if (!allCommitsWithHistory.length) {
          return { index, item: { path, error: "No commits found", historyUrl } };
        }

        if (mode === "updated") {
          const latestCommit = findLatestNonExcludedCommit(allCommitsWithHistory);

          if (!latestCommit) {
            return { index, item: { path, authorName: null, sha: null, date: null, historyUrl } };
          }

          const authorName = pickAuthorNameOrNull(latestCommit);
          return {
            index,
            item: {
              path,
              authorName,
              sha: latestCommit.sha ?? null,
              date: latestCommit.commit?.author?.date ?? null,
              historyUrl,
            },
          };
        } else {
          const firstCommit = allCommitsWithHistory[allCommitsWithHistory.length - 1] ?? null;

          const alt = firstCommit ? getAlternateAuthorName(firstCommit) : null;
          if (alt) {
            return {
              index,
              item: {
                path,
                authorName: alt,
                sha: firstCommit.sha ?? null,
                date: firstCommit.commit?.author?.date ?? null,
                historyUrl,
              },
            };
          }

          return {
            index,
            item: {
              path,
              authorName: null,
              sha: firstCommit?.sha ?? null,
              date: firstCommit?.commit?.author?.date ?? null,
              historyUrl,
            },
          };
        }
      } catch (e: any) {
        return { index, item: { path, error: e?.message ?? String(e), historyUrl } };
      }
    });

    computed.push(...batchResults);
  }

  for (const { index, item } of computed) {
    results[index] = item;
    const key = cacheKey(mode, ref, item.path);
    cacheSet(key, item);
  }

  return NextResponse.json(
    { ok: true, owner, repo, mode, ref, results },
    {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
        "X-Route-Cache": cacheHits === normalizedPaths.length ? "HIT" : cacheHits === 0 ? "MISS" : "PARTIAL",
        "X-Route-Cache-Hits": String(cacheHits),
        "X-Route-Cache-Total": String(normalizedPaths.length),
      },
    }
  );
}
