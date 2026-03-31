import React from "react";
import Breadcrumbs from "@/app/(home)/components/Breadcrumbs";
import { Section } from "@/app/(home)/components/layout/section";
import { fetchAllArchivedRules, fetchLatestRules } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import client from "@/tina/__generated__/client";
import ArchivedClientPage from "./client-page";

export const revalidate = 300;

async function fetchHomepageData() {
  try {
    const res = await client.queries.homepage({ relativePath: "index.json" });
    return { data: res.data, query: res.query, variables: res.variables };
  } catch (error) {
    console.error("Failed to fetch homepage data from Tina CMS:", error);
    return { data: null, query: null, variables: { relativePath: "index.json" } };
  }
}

export default async function ArchivedPage() {
  const [archivedRules, latestRules, homepageData] = await Promise.all([fetchAllArchivedRules(), fetchLatestRules(), fetchHomepageData()]);

  const archivedRulesWithReason = archivedRules.filter((rule) => rule.archivedreason?.trim());

  return (
    <Section>
      <Breadcrumbs breadcrumbText="Archived Rules" />
      <ArchivedClientPage archivedRules={archivedRulesWithReason} latestRules={latestRules} homepageData={homepageData} />
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "Archived Rules | SSW Rules",
    description: "Rules that have been archived",
    alternates: {
      canonical: `${siteUrl}/archived`,
    },
  };
}
