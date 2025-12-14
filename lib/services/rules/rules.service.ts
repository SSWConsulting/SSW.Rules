import { unstable_cache } from "next/cache";
import { PaginationResult, PaginationVars } from "@/models/Pagination";
import { QueryResult } from "@/models/QueryResult";
import { Rule } from "@/models/Rule";
import client from "@/tina/__generated__/client";
import ruleToCategories from "../../../rule-to-categories.json";

type RuleSearchField = "title" | "uri";

type RuleQueryVars = PaginationVars & {
  q?: string;
  field?: RuleSearchField;
  sort?: string;
};

// Internal function that performs the actual data fetching
async function fetchLatestRulesData(size: number = 5, sortOption: "lastUpdated" | "created" = "lastUpdated", includeBody: boolean = false) {
  const res = await client.queries.latestRulesQuery({
    size,
    sortOption,
    includeBody,
  });

  const results = res?.data?.ruleConnection?.edges?.filter((edge: any) => edge && edge.node).map((edge: any) => edge.node) || [];

  // Attach an authorUrl (if found) to each result object
  const enhanced = results.map((r: any) => {
    const authorUrl = findAuthorUrlForResult(r);
    return {
      ...r,
      authorUrl,
    };
  });

  return enhanced;
}

export async function fetchLatestRules(size: number = 5, sortOption: "lastUpdated" | "created" = "lastUpdated", includeBody: boolean = false) {
  // Create a cached function with tags for revalidation
  const getCachedLatestRules = unstable_cache(
    fetchLatestRulesData,
    [`latest-rules-${size}-${sortOption}-${includeBody}`], // Cache key includes all parameters
    {
      tags: ["latest-rules"], // Tag for revalidation
    }
  );

  return await getCachedLatestRules(size, sortOption, includeBody);
}

// Helper: find author's URL by matching lastUpdatedBy (or createdBy) to authors[].title
export function findAuthorUrlForResult(result: any): string | null {
  if (!result) return null;

  const candidates = Array.isArray(result.authors) ? result.authors : [];

  // Choose the primary name to match: prefer lastUpdated, fall back to created
  const primaryName = (result.lastUpdatedBy || result.createdBy || "").trim();
  if (!primaryName || candidates.length === 0) return null;

  // Normalize helper
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

  const primaryNorm = normalize(primaryName);
  const primaryWords = primaryNorm.split(/\s+/).filter(Boolean);

  let bestMatch: { score: number; url: string | null } = { score: 0, url: null };

  for (const a of candidates) {
    if (!a || !a.title) continue;
    const title = String(a.title || "");
    const titleNorm = normalize(title);

    // Exact match quick path
    if (titleNorm === primaryNorm) {
      return a.url || null;
    }

    // Score by word overlap (number of shared words)
    const titleWords = titleNorm.split(/\s+/).filter(Boolean);
    const sharedWords = primaryWords.filter((w) => titleWords.includes(w)).length;

    // Secondary score: longest common substring length between the two normalized strings
    const lcsLen = longestCommonSubstring(primaryNorm, titleNorm);

    // Combine scores: give more weight to shared words, but include lcs
    const score = sharedWords * 100 + lcsLen;

    if (score > bestMatch.score) {
      bestMatch = { score, url: a.url || null };
    }
  }

  return bestMatch.url;
}

// Compute length of longest common substring between two strings (simple DP)
function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  // Use typed arrays for performance
  let prev = new Uint16Array(n + 1);
  let max = 0;
  for (let i = 1; i <= m; i++) {
    const cur = new Uint16Array(n + 1);
    for (let j = 1; j <= n; j++) {
      if (a.charCodeAt(i - 1) === b.charCodeAt(j - 1)) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > max) max = cur[j];
      }
    }
    prev = cur;
  }
  return max;
}

export async function fetchRuleCount() {
  return Object.keys(ruleToCategories).length;
}

export async function fetchArchivedRules(variables: { first?: number; after?: string } = {}): Promise<QueryResult<Rule>> {
  const result = await client.queries.archivedRulesQuery(variables);

  const archivedRules = result.data.ruleConnection?.edges ? result.data.ruleConnection.edges.map((edge: any) => edge.node) : [];

  return {
    data: archivedRules as Rule[],
    pageInfo: result.data.ruleConnection?.pageInfo || { hasNextPage: false, endCursor: "" },
  };
}

export async function fetchAllArchivedRules(firstPerPage = 50): Promise<Rule[]> {
  const all: Rule[] = [];
  let after: string | undefined = undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const { data, pageInfo } = await fetchArchivedRules({
      first: firstPerPage,
      after,
    });

    all.push(...data);

    hasNextPage = pageInfo.hasNextPage;
    after = pageInfo.endCursor || undefined;
  }

  return all;
}

export async function fetchPaginatedRules(variables: RuleQueryVars = {}): Promise<PaginationResult<Rule>> {
  const { first, last, after, before, q, field = "title", sort } = variables;

  const filter = q && q.trim() ? { [field]: { startsWith: q.trim() } } : undefined;

  const res = await client.queries.paginatedRulesQuery({
    first,
    last,
    after,
    before,
    sort,
    filter,
  });

  const conn = res?.data?.ruleConnection;
  const nodes = (conn?.edges ?? []).map((e: any) => e?.node).filter(Boolean);

  return {
    items: nodes as Rule[],
    pageInfo: {
      hasNextPage: !!conn?.pageInfo?.hasNextPage,
      hasPreviousPage: !!conn?.pageInfo?.hasPreviousPage,
      startCursor: conn?.pageInfo?.startCursor ?? null,
      endCursor: conn?.pageInfo?.endCursor ?? null,
    },
    totalCount: conn?.totalCount ?? 0,
  };
}
