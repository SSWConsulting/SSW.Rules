import React from "react";
import { Section } from "@/components/layout/section";
import client from "@/tina/__generated__/client";
import Layout from "@/components/layout/layout";
import SearchBar from "@/components/SearchBar";
import HomeClientPage from "./client-page";
import ruleToCategories from "../rule-to-categories.json";
import Breadcrumbs from "@/components/Breadcrumbs";

export const revalidate = 300;

async function fetchAllCategories() {
  let hasNextPage = true;
  let after: string | null = null;
  const allCategories: any[] = [];

  while (hasNextPage) {
    const res = await client.queries.homepageCategoriesQuery({
      first: 50,
      after,
    });

    const edges = res?.data?.categoryConnection?.edges || [];

    allCategories.push(
      ...edges
        .filter((edge: any) => edge && edge.node && edge.node.__typename !== "CategoryMain")
        .map((edge: any) => edge.node)
    );

    hasNextPage = res?.data?.categoryConnection?.pageInfo?.hasNextPage;
    after = res?.data?.categoryConnection?.pageInfo?.endCursor;
  }
  return allCategories;
}

async function fetchLatestRules() {
  const res = await client.queries.latestRulesQuery({
    size: 5,
    sortOption: "lastUpdated",
  });

  return (
    res?.data?.ruleConnection?.edges
      ?.filter((edge: any) => edge && edge.node)
      .map((edge: any) => edge.node) || []
  );
}

async function fetchRuleCount() {
  return Object.keys(ruleToCategories).length;
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
  const [categories, latestRules, ruleCount, categoryRuleCounts] = await Promise.all([
    fetchAllCategories(),
    fetchLatestRules(),
    fetchRuleCount(),
    Promise.resolve(buildCategoryRuleCounts()),
  ]);

  const layout = await Layout({
    children: (
      <Section>
        <Breadcrumbs isHomePage />
        <HomeClientPage categories={categories} latestRules={latestRules} ruleCount={ruleCount} categoryRuleCounts={categoryRuleCounts} />
      </Section>
    ),
  });

  return layout;
}
