import React from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import { fetchAllArchivedRules, fetchLatestRules } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import client from "@/tina/__generated__/client";
import { QuickLink } from "@/types/quickLink";
import ArchivedClientPage from "./client-page";

export const revalidate = 300;

async function fetchQuickLinks(): Promise<QuickLink[]> {
  const res = await client.queries.global({
    relativePath: "index.json",
  });
  return Array.isArray(res.data.global.quickLinks?.links) ? (res.data.global.quickLinks.links as QuickLink[]) : [];
}

export default async function ArchivedPage() {
  const [archivedRules, latestRules, quickLinks] = await Promise.all([fetchAllArchivedRules(), fetchLatestRules(), fetchQuickLinks()]);

  const archivedRulesWithReason = archivedRules.filter((rule) => rule.archivedreason?.trim());

  return (
    <Section>
      <Breadcrumbs breadcrumbText="Archived Rules" />
      <ArchivedClientPage archivedRules={archivedRulesWithReason} latestRules={latestRules} quickLinks={quickLinks} />
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
