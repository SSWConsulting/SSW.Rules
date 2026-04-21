import React from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import { hasAssignedCategory } from "@/lib/services/rules/orphaned-rules";
import { OrphanedRulesData } from "@/models/OrphanedRule";
import { Rule } from "@/models/Rule";
import orphanedRulesData from "@/orphaned_rules.json";
import { siteUrl } from "@/site-config";
import client from "@/tina/__generated__/client";
import OrphanedClientPage from "./client-page";

export const revalidate = 300;

const fetchOrphanedRulesData = async (): Promise<Rule[]> => {
  const rules: Rule[] = [];
  const typedOrphanedRulesData: OrphanedRulesData = orphanedRulesData;

  for (const orphanedRule of typedOrphanedRulesData) {
    try {
      const ruleData = await client.queries.ruleData({
        relativePath: `${orphanedRule.uri}/rule.mdx`,
      });

      if (ruleData?.data?.rule) {
        const rule = ruleData.data.rule;
        if (hasAssignedCategory(rule.categories)) {
          continue;
        }

        rules.push({
          guid: rule.guid || "",
          title: rule.title || "",
          uri: rule.uri || orphanedRule.uri,
          body: rule.body || "",
          isArchived: rule.isArchived || false,
          archivedreason: rule.archivedreason || undefined,
          authors: rule.authors || [],
          lastUpdated: rule.lastUpdated || undefined,
          lastUpdatedBy: rule.lastUpdatedBy || undefined,
        });
      }
    } catch (error) {
      console.error(`Error fetching rule data for ${orphanedRule.uri}:`, error);
    }
  }

  return rules;
};

export default async function OrphanedPage() {
  const orphanedRules = await fetchOrphanedRulesData();

  return (
    <Section>
      <Breadcrumbs breadcrumbText="Orphaned Rules" />
      <OrphanedClientPage orphanedRules={orphanedRules} />
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "Orphaned Rules | SSW Rules",
    description: "Rules that have no parent category",
    alternates: {
      canonical: `${siteUrl}/orphaned`,
    },
  };
}
