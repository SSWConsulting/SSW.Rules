import React from "react";
import { Section } from "@/components/layout/section";
import Breadcrumbs from "@/components/Breadcrumbs";
import { fetchArchivedRulesData, fetchLatestRules } from "@/lib/services/rules";
import client from "@/tina/__generated__/client";
import ArchivedClientPage from "./client-page";
import { QuickLink } from "@/types/quickLink";

export const revalidate = 300;

async function fetchTopCategoriesWithSubcategories() {
  // Fetch the main category index file with all top categories expanded in one query
  // This preserves the order defined in the main category index file
  const result = await client.queries.mainCategoryQuery();

  if (!result?.data?.category || result.data.category.__typename !== "CategoryMain") {
    return [];
  }

  // Extract top categories from the index array (already includes subcategories)
  const topCategories = result.data.category.index
    ?.map((item: any) => item?.top_category)
    .filter(Boolean) || [];

  return topCategories;
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