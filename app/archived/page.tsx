import React from "react";
import Breadcrumbs from "@/app/(home)/components/Breadcrumbs";
import { Section } from "@/app/(home)/components/layout/section";
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
  return {
    title: "Archived Rules | SSW Rules",
    description: "Rules that have been archived",
    alternates: {
      canonical: `${siteUrl}/archived`,
    },
  };
}
