import React from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import { fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import client from "@/tina/__generated__/client";
import { QuickLink } from "@/types/quickLink";
import ruleToCategories from "../rule-to-categories.json";
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

function buildCategoryRuleCounts(): Record<string, number> {
  const counts: Record<string, number> = {};

  Object.values(ruleToCategories).forEach((categories) => {
    categories.forEach((category) => {
      counts[category] = (counts[category] || 0) + 1;
    });
  });

  return counts;
}

export default async function Home() {
  const [topCategories, latestRules, ruleCount, categoryRuleCounts, quickLinks] = await Promise.all([
    fetchTopCategoriesWithSubcategories(),
    fetchLatestRules(),
    fetchRuleCount(),
    Promise.resolve(buildCategoryRuleCounts()),
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
