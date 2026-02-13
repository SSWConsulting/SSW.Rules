import React from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import { fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import client from "@/tina/__generated__/client";
import { QuickLink } from "@/types/quickLink";
import HomeClientPage from "./client-page";

export const revalidate = 300;

async function fetchTopCategoriesWithSubcategories() {
  // Fetch the main category index file with all top categories expanded in one query
  // This preserves the order defined in the main category index file
  const result = await client.queries.mainCategoryQuery();

  if (!result?.data?.category || result.data.category.__typename !== "CategoryMain") {
    return [];
  }

  // Extract top categories from the index array (already includes subcategories)
  const topCategories = result.data.category.index?.map((item: any) => item?.top_category).filter(Boolean) || [];

  return topCategories;
}

async function fetchQuickLinks(): Promise<QuickLink[]> {
  const res = await client.queries.global({
    relativePath: "index.json",
  });
  return Array.isArray(res.data.global.quickLinks?.links) ? (res.data.global.quickLinks.links as QuickLink[]) : [];
}

async function fetchCategoryRuleCountsFromTina(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await client.queries.categoryRuleCountsQuery({
      first: 50,
      after,
    });

    const conn = res.data.categoryConnection;
    const edges = conn.edges ?? [];

    for (const edge of edges) {
      const node: any = edge?.node;
      if (!node) continue;

      if (node.__typename !== "CategoryCategory") continue;

      const filename = node._sys?.filename;
      const ruleCount = Array.isArray(node.index) ? node.index.length : 0;

      if (filename) counts[filename] = ruleCount;
    }

    hasNextPage = !!conn.pageInfo?.hasNextPage;
    after = conn.pageInfo?.endCursor ?? null;
  }

  return counts;
}

export default async function Home() {
  const [topCategories, latestRules, ruleCount, categoryRuleCounts, quickLinks] = await Promise.all([
    fetchTopCategoriesWithSubcategories(),
    fetchLatestRules(),
    fetchRuleCount(),
    fetchCategoryRuleCountsFromTina(),
    fetchQuickLinks(),
  ]);

  return (
    <Section>
      <Breadcrumbs isHomePage />
      <HomeClientPage
        topCategories={topCategories}
        latestRules={latestRules}
        ruleCount={ruleCount}
        categoryRuleCounts={categoryRuleCounts}
        quickLinks={quickLinks}
      />
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "SSW.Rules | Secret Ingredients for Quality Software (Open Source on GitHub)",
    alternates: {
      canonical: `${siteUrl}/`,
    },
  };
}
