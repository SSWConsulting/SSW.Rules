import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { createGitHubService } from "@/lib/services/github";
import client from "@/tina/__generated__/client";
import { selectLatestRuleFilesByPath } from "@/utils/selectLatestRuleFilesByPath";

export const dynamic = "force-dynamic";

type RuleItem = { title: string; uri: string; lastModifiedAt: string | null };
type ChangedRuleFile = { path: string; mergedAt: string | null };

const ALLOWED_ORIGIN = "https://ssw.com.au";
const CACHE_SECONDS = 60 * 60 * 2;
const MAX_PR_PAGES = 20;

function addCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  return addCors(new NextResponse(null, { status: 204 }));
}

function ruleUriFromPath(path?: string): string | null {
  if (!path) return null;

  return (
    path
      .replace(/\/rule\.md$/, "/rule.mdx")
      .replace(/^(public\/uploads\/rules|rules)\//, "")
      .replace(/\/rule\.mdx$/, "") || null
  );
}

/**
 * Extract rule files from PR nodes
 */
function extractRuleFilesFromPRs(
  prs: any[],
  seen: Set<string>,
  collected: ChangedRuleFile[]
): void {
  for (const pr of prs) {
    const mergedAt = typeof pr?.mergedAt === "string" ? pr.mergedAt : null;
    const files = Array.isArray(pr?.files?.nodes) ? pr.files.nodes : [];

    for (const f of files) {
      const path = typeof f?.path === "string" ? f.path : undefined;
      if (!path) continue;
      if (!path.endsWith("rule.mdx") && !path.endsWith("rule.md")) continue;
      if (seen.has(path)) continue;

      seen.add(path);
      collected.push({ path, mergedAt });
    }
  }
}

/**
 * Collect PRs authored directly by the user
 */
async function collectDirectAuthoredFiles(
  service: Awaited<ReturnType<typeof createGitHubService>>,
  username: string,
  minUniqueRules: number,
  seen: Set<string>,
  collected: ChangedRuleFile[]
): Promise<void> {
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PR_PAGES; page++) {
    const raw = (await service.searchPullRequestsByAuthor(username, cursor, "after")) as unknown;

    const search = typeof raw === "object" && raw !== null ? (raw as any).search : undefined;
    const prs = Array.isArray(search?.nodes) ? search.nodes : [];
    const pageInfo = search?.pageInfo;

    cursor = typeof pageInfo?.endCursor === "string" ? pageInfo.endCursor : undefined;

    extractRuleFilesFromPRs(prs, seen, collected);

    const unique = selectLatestRuleFilesByPath(collected);
    if (unique.length >= minUniqueRules) break;
    if (!pageInfo?.hasNextPage || !cursor) break;
  }
}

/**
 * Collect PRs by TinaCMS bot where the user is a co-author
 */
async function collectTinaBotCoAuthoredFiles(
  service: Awaited<ReturnType<typeof createGitHubService>>,
  username: string,
  minUniqueRules: number,
  seen: Set<string>,
  collected: ChangedRuleFile[]
): Promise<void> {
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PR_PAGES; page++) {
    const result = await service.searchTinaBotPRsByCoAuthor(username, cursor);

    const prs = result.search.nodes;
    const pageInfo = result.search.pageInfo;

    cursor = typeof pageInfo?.endCursor === "string" ? pageInfo.endCursor : undefined;

    extractRuleFilesFromPRs(prs, seen, collected);

    const unique = selectLatestRuleFilesByPath(collected);
    if (unique.length >= minUniqueRules) break;
    if (!pageInfo?.hasNextPage || !cursor) break;
  }
}

async function collectRecentChangedRuleFiles(username: string, minUniqueRules: number): Promise<ChangedRuleFile[]> {
  const service = await createGitHubService();

  const seen = new Set<string>();
  const collected: ChangedRuleFile[] = [];

  // 1. Collect PRs authored directly by the user
  await collectDirectAuthoredFiles(service, username, minUniqueRules, seen, collected);

  // 2. Also collect PRs by TinaCMS bot where the user is a co-author
  // This ensures rules updated via TinaCMS admin panel are attributed correctly
  await collectTinaBotCoAuthoredFiles(service, username, minUniqueRules, seen, collected);

  return selectLatestRuleFilesByPath(collected);
}

function buildUriToLastModified(files: ChangedRuleFile[]) {
  const uriToLastModified = new Map<string, string>();
  const uris: string[] = [];

  for (const f of files) {
    const uri = ruleUriFromPath(f.path);
    if (!uri) continue;

    if (!uriToLastModified.has(uri)) uris.push(uri);

    if (!f.mergedAt) continue;

    const prev = uriToLastModified.get(uri);
    if (!prev || Date.parse(f.mergedAt) > Date.parse(prev)) {
      uriToLastModified.set(uri, f.mergedAt);
    }
  }

  return { uris, uriToLastModified };
}

async function fetchRuleItemsByUris(uris: string[], uriToLastModified: Map<string, string>, limit: number): Promise<RuleItem[]> {
  if (!uris.length) return [];

  const res = await client.queries.rulesByUriQuery({ uris });
  const edges = Array.isArray(res.data?.ruleConnection?.edges) ? res.data.ruleConnection.edges : [];

  return edges
    .map((e) => e?.node)
    .filter((r): r is { title: string; uri: string } => typeof r?.title === "string" && typeof r?.uri === "string")
    .map((r) => ({
      title: r.title,
      uri: r.uri,
      lastModifiedAt: uriToLastModified.get(r.uri) ?? null,
    }))
    .sort((a, b) => (b.lastModifiedAt ? Date.parse(b.lastModifiedAt) : 0) - (a.lastModifiedAt ? Date.parse(a.lastModifiedAt) : 0))
    .slice(0, limit);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = (searchParams.get("username") || "").trim();
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 10)));

    if (!username) {
      return addCors(NextResponse.json({ error: "Missing username" }, { status: 400 }));
    }

    const getCachedResult = unstable_cache(
      async (u: string, lim: number) => {
        const changedFiles = await collectRecentChangedRuleFiles(u, lim);
        const { uris, uriToLastModified } = buildUriToLastModified(changedFiles);
        const items = await fetchRuleItemsByUris(uris, uriToLastModified, lim);
        return { items };
      },
      [`last-modified-rules-items-v1-${username}-${limit}`],
      { revalidate: CACHE_SECONDS }
    );

    const result = await getCachedResult(username, limit);
    return addCors(NextResponse.json({ username, limit, ...result }));
  } catch (e) {
    return addCors(NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 }));
  }
}
