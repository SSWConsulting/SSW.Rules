import { unstable_cache } from "next/cache";
import { toSlug } from "@/lib/utils";
import { PaginationResult, PaginationVars } from "@/models/Pagination";
import { QueryResult } from "@/models/QueryResult";
import { Rule } from "@/models/Rule";
import client from "@/tina/__generated__/client";

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

  const enhanced = results.map((r: any) => {
    const displayName = r.lastUpdatedBy || r.createdBy;
    const authorUrl = displayName ? `https://ssw.com.au/people/${toSlug(displayName)}/` : null;
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

// Shared function that fetches category rule data and computes both total unique rules and per-category counts
async function fetchCategoryRuleData(): Promise<{
  totalUniqueRules: number;
  categoryRuleCounts: Record<string, number>;
}> {
  const uniqueRulePaths = new Set<string>();
  const counts: Record<string, number> = {};

  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res: any = await client.queries.categoryRuleCountsQuery({
      first: 50,
      after,
    });

    const conn: any = res?.data?.categoryConnection;
    const edges = conn?.edges ?? [];

    for (const edge of edges) {
      const categoryNode: any = edge?.node;
      if (!categoryNode || categoryNode.__typename !== "CategoryCategory") continue;

      const filename = categoryNode._sys?.filename;
      let categoryRuleCount = 0;

      for (const indexItem of categoryNode.index ?? []) {
        const rule: any = indexItem?.rule;
        if (!rule || rule.__typename !== "Rule") continue;
        if (rule.isArchived) continue;

        categoryRuleCount++;

        const relativePath = rule?._sys?.relativePath;
        if (typeof relativePath === "string" && relativePath) {
          uniqueRulePaths.add(relativePath);
        }
      }

      if (filename) {
        counts[filename] = categoryRuleCount;
      }
    }

    hasNextPage = !!conn?.pageInfo?.hasNextPage;
    after = conn?.pageInfo?.endCursor ?? null;
  }

  return {
    totalUniqueRules: uniqueRulePaths.size,
    categoryRuleCounts: counts,
  };
}

// Cached version of the shared fetch function
// Both fetchRuleCount() and fetchCategoryRuleCounts() use this same cache to avoid duplicate API calls
const getCachedCategoryRuleData = unstable_cache(fetchCategoryRuleData, ["category-rule-data"], {
  tags: ["category-rule-data", "rule-count"],
});

export async function fetchRuleCount(): Promise<number> {
  const data = await getCachedCategoryRuleData();
  return data.totalUniqueRules;
}

export async function fetchCategoryRuleCounts(): Promise<Record<string, number>> {
  const data = await getCachedCategoryRuleData();
  return data.categoryRuleCounts;
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
