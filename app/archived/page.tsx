import React from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import { fetchAllArchivedRules, fetchLatestRules, fetchQuickLinks } from "@/lib/services/rules";
import { trackServerException } from "@/lib/server/appInsightsServer";
import { siteUrl } from "@/site-config";
import ArchivedClientPage from "./client-page";

export const revalidate = 300;

export default async function ArchivedPage() {
  let archivedRules, latestRules, quickLinks;
  try {
    [archivedRules, latestRules, quickLinks] = await Promise.all([fetchAllArchivedRules(), fetchLatestRules(), fetchQuickLinks()]);
  } catch (error) {
    trackServerException(error, { component: "ArchivedPage" });
    return (
      <Section>
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-lg text-gray-500">
            This page is temporarily unavailable due to a data issue.
            Please try refreshing in a few minutes.
          </p>
        </div>
      </Section>
    );
  }

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
