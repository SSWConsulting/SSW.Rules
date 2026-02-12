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

async function fetchRuleCountData(): Promise<number> {
  const uniqueRules = new Set<string>();

  let after: string | undefined = undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await client.queries.categoryRuleRefsForCount({
      first: 200,
      after,
    });

    const conn = res?.data?.categoryConnection;
    const nodes = (conn?.edges ?? []).map((e: any) => e?.node).filter(Boolean);

    for (const n of nodes) {
      if (n.__typename !== "CategoryCategory") continue;

      const idx = Array.isArray(n.index) ? n.index : [];
      for (const item of idx) {
        const ref = item?.rule;
        if (typeof ref === "string" && ref.length > 0) uniqueRules.add(ref);
      }
    }

    hasNextPage = !!conn?.pageInfo?.hasNextPage;
    after = conn?.pageInfo?.endCursor ?? undefined;
  }

  return uniqueRules.size;
}

export async function fetchRuleCount() {
  const getCachedRuleCount = unstable_cache(fetchRuleCountData, ["rule-count"], {
    revalidate: 300,
    tags: ["rule-count"],
  });

  return await getCachedRuleCount();
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
