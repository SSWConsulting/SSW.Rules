import React, { Suspense } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import { fetchCategoryRuleCounts, fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import client from "@/tina/__generated__/client";
import { QuickLink } from "@/types/quickLink";
import HomeClientPage from "@/app/client-page";

export const revalidate = 21600; // 6 hours

async function fetchTopCategoriesWithSubcategories() {
  const result = await client.queries.mainCategoryQuery();

  if (!result?.data?.category || result.data.category.__typename !== "CategoryMain") {
    return [];
  }

  const topCategories = result.data.category.index?.map((item: any) => item?.top_category).filter(Boolean) || [];

  return topCategories;
}

async function fetchQuickLinks(): Promise<QuickLink[]> {
  const res = await client.queries.global({
    relativePath: "index.json",
  });
  return Array.isArray(res.data.global.quickLinks?.links) ? (res.data.global.quickLinks.links as QuickLink[]) : [];
}

export default async function CategoriesPage() {
  const [topCategories, latestRules, ruleCount, categoryRuleCounts, quickLinks] = await Promise.all([
    fetchTopCategoriesWithSubcategories(),
    fetchLatestRules(),
    fetchRuleCount(),
    fetchCategoryRuleCounts(),
    fetchQuickLinks(),
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
          activityRules={[]}
          recentComments={[]}
          initialView="categories"
        />
      </Suspense>
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "SSW.Rules | Categories",
    alternates: {
      canonical: `${siteUrl}/categories`,
    },
  };
}
