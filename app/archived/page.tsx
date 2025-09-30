import React from "react";
import { Section } from "@/components/layout/section";
import Breadcrumbs from "@/components/Breadcrumbs";
import { fetchArchivedRulesData, fetchLatestRules } from "@/lib/services/rules";
import client from "@/tina/__generated__/client";
import ArchivedClientPage from "./client-page";
import { QuickLink } from "@/types/quickLink";

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

async function fetchQuickLinks(): Promise<QuickLink[]> {
  const res = await client.queries.global({
    relativePath: "index.json",
  });
  return Array.isArray(res.data.global.quickLinks?.links) ? res.data.global.quickLinks.links as QuickLink[] : [];
}

export default async function ArchivedPage() {
  const [archivedRules, topCategories, latestRules, quickLinks] = await Promise.all([
    fetchArchivedRulesData(),
    fetchTopCategoriesWithSubcategories(),
    fetchLatestRules(),
    fetchQuickLinks()
  ]);

  return (
    <Section>
      <Breadcrumbs breadcrumbText="Archived Rules" />
      <ArchivedClientPage 
        archivedRules={archivedRules} 
        topCategories={topCategories} 
        latestRules={latestRules}
        quickLinks={quickLinks}
      />
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "Archived Rules | SSW Rules",
    description: "Rules that have been archived",
  };
}