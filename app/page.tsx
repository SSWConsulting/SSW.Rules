import React, { Suspense } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import { fetchDiscussionData } from "@/lib/services/github/discussions.service";
import { fetchCategoryRuleCounts, fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import client from "@/tina/__generated__/client";
import { QuickLink } from "@/types/quickLink";
import HomeClientPage from "./client-page";

export const revalidate = 21600; // 6 hours

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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; sort?: string }>;
}) {
  const [resolvedParams, topCategories, latestRules, ruleCount, categoryRuleCounts, quickLinks, activityData] = await Promise.all([
    searchParams,
    fetchTopCategoriesWithSubcategories(),
    fetchLatestRules(),
    fetchRuleCount(),
    fetchCategoryRuleCounts(),
    fetchQuickLinks(),
    fetchDiscussionData(),
  ]);

  return (
    <Section>
      <Breadcrumbs isHomePage />
      <Suspense fallback={null}>
        <HomeClientPage
          topCategories={topCategories}
          latestRules={latestRules}
          ruleCount={ruleCount}
          categoryRuleCounts={categoryRuleCounts}
          quickLinks={quickLinks}
          activityRules={activityData.activityRules}
          recentComments={activityData.recentComments}
          initialView={resolvedParams.view === "categories" ? "categories" : "activity"}
          initialSort={resolvedParams.sort}
        />
      </Suspense>
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
