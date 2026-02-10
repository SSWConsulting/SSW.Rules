import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createGitHubService } from "@/lib/services/github";
import client from "@/tina/__generated__/client";

type RuleItem = { title: string; uri: string; lastModifiedAt: string | null; body: any };

const ALLOWED_ORIGIN = "https://ssw.com.au";
const CACHE_SECONDS = 60 * 60 * 2;

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

function getRuleFilesFromPRs(prs: any[]): Array<{ path: string; mergedAt: string }> {
  const ruleMap = new Map<string, { path: string; mergedAt: string }>();

  for (const pr of prs) {
    const mergedAt = pr.mergedAt;
    if (!mergedAt) continue;

    const files = pr.files?.nodes || [];
    for (const file of files) {
      const path = file.path;
      if (!path || (!path.endsWith('rule.md') && !path.endsWith('rule.mdx'))) continue;

      const uri = ruleUriFromPath(path);
      if (!uri) continue;

      const existing = ruleMap.get(uri);
      if (!existing || new Date(mergedAt) > new Date(existing.mergedAt)) {
        ruleMap.set(uri, { path, mergedAt });
      }
    }
  }

  return Array.from(ruleMap.values());
}

async function getRecentRulesForUser(username: string, limit: number): Promise<RuleItem[]> {
  const service = await createGitHubService();
  const prs = await service.getPRsForUser(username, limit);
  const ruleFiles = getRuleFilesFromPRs(prs);

  const uriToDate = new Map<string, string>();
  const uris: string[] = [];

  for (const file of ruleFiles) {
    const uri = ruleUriFromPath(file.path);
    if (!uri) continue;

    if (!uriToDate.has(uri)) uris.push(uri);
    if (file.mergedAt) {
      const current = uriToDate.get(uri);
      if (!current || new Date(file.mergedAt) > new Date(current)) {
        uriToDate.set(uri, file.mergedAt);
      }
    }
  }

  if (uris.length === 0) return [];

  try {
    const res = await client.queries.rulesByUriQuery({ uris });
    const edges = res.data?.ruleConnection?.edges || [];

    return edges
      .map(e => e?.node)
      .filter((node): node is { title: string; uri: string, body: any } => 
        !!node && typeof node.title === 'string' && typeof node.uri === 'string'
      )
      .map(node => {
        return {
          title: node.title,
          uri: node.uri,
          lastModifiedAt: uriToDate.get(node.uri) || null,
          body: node.body
      }
      })
      .sort((a, b) => {
        const dateA = a.lastModifiedAt ? new Date(a.lastModifiedAt).getTime() : 0;
        const dateB = b.lastModifiedAt ? new Date(b.lastModifiedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit);
  } catch (error) {
    console.error("Failed to fetch rule metadata from TinaCMS in getRecentRulesForUser:", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to fetch rule metadata from TinaCMS");
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim();
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 5)));

    if (!username) {
      return addCors(NextResponse.json({ error: "Missing username" }, { status: 400 }));
    }

    const getCachedResult = unstable_cache(
      async (u: string, lim: number) => {
        const items = await getRecentRulesForUser(u, lim);
        return { items };
      },
      [`last-modified-rules-${username}-${limit}`],
      { revalidate: CACHE_SECONDS }
    );

    const result = await getCachedResult(username, limit);
    return addCors(NextResponse.json({ username, limit, ...result }));
  } catch (error) {
    return addCors(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      )
    );
  }
}