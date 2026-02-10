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

async function fetchCategoryRuleCounts(topCategories: any[]): Promise<Record<string, number>> {
  const entries = (topCategories || []).flatMap((topCategory) => {
    return (topCategory?.index || []).map((item: any) => {
      const key = item?.category?._sys?.filename;
      const count = Array.isArray(item?.category?.index) ? item.category.index.length : 0;
      return typeof key === "string" && key.length > 0 ? ([key, count] as const) : null;
    });
  });

  return Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, number]>);
}

export default async function Home() {
  const topCategories = await fetchTopCategoriesWithSubcategories();

  const [latestRules, ruleCount, categoryRuleCounts, quickLinks] = await Promise.all([
    fetchLatestRules(),
    fetchRuleCount(),
    fetchCategoryRuleCounts(topCategories),
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
