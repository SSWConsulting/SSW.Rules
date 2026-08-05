import React from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import { pageMetadata } from "@/lib/pageMetadata";
import { fetchAllArchivedRules, fetchHomepageData, fetchLatestRules } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import ArchivedClientPage from "./client-page";

export const revalidate = 300;

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
  return pageMetadata({ title: "Archived Rules | SSW Rules", description: "Rules that have been archived", path: "archived" });
}
