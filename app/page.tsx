import React from "react";
import { Section } from "@/components/layout/section";
import client from "@/tina/__generated__/client";
import Layout from "@/components/layout/layout";
import HomeClientPage from "./client-page";
import ruleToCategories from "../rule-to-categories.json";
import Breadcrumbs from "@/components/Breadcrumbs";
import { fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";

export const revalidate = 300;

async function fetchTopCategoriesWithSubcategories() {
  let hasNextPage = true;
  let after: string | null = null;
  const allTopCategories: any[] = [];

  while (hasNextPage) {
    const res = await client.queries.paginatedTopCategoriesQuery({
      first: 50,
      after,
    });

    const edges = res?.data?.categoryConnection?.edges || [];

    allTopCategories.push(
      ...edges
        .filter((edge: any) => edge && edge.node && edge.node.__typename === "CategoryTop_category")
        .map((edge: any) => edge.node)
    );

    hasNextPage = res?.data?.categoryConnection?.pageInfo?.hasNextPage;
    after = res?.data?.categoryConnection?.pageInfo?.endCursor;
  }
  return allTopCategories;
}



function buildCategoryRuleCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  
  Object.values(ruleToCategories).forEach(categories => {
    categories.forEach(category => {
      counts[category] = (counts[category] || 0) + 1;
    });
  });
  
  return counts;
}

export default async function Home() {
  const [topCategories, latestRules, ruleCount, categoryRuleCounts] = await Promise.all([
    fetchTopCategoriesWithSubcategories(),
    fetchLatestRules(),
    fetchRuleCount(),
    Promise.resolve(buildCategoryRuleCounts()),
  ]);

  return (
      <Section>
        <Breadcrumbs isHomePage />
        <HomeClientPage
          topCategories={topCategories}
          latestRules={latestRules}
          ruleCount={ruleCount}
          categoryRuleCounts={categoryRuleCounts}
        />
      </Section>
  )
}

export async function generateMetadata() {
  return {
    title: "SSW.Rules | Secret Ingredients for Quality Software (Open Source on GitHub)",
  }
}
