import React from "react";
import { Section } from "@/components/layout/section";
import Breadcrumbs from "@/components/Breadcrumbs";
import OrphanedClientPage from "./client-page";
import client from "@/tina/__generated__/client";
import { Rule } from "@/models/Rule";
import { OrphanedRulesData } from "@/models/OrphanedRule";
import orphanedRulesData from "@/orphaned_rules.json";

export const revalidate = 300;

const fetchOrphanedRulesData = async (): Promise<Rule[]> => {
  const rules: Rule[] = [];
  const typedOrphanedRulesData: OrphanedRulesData = orphanedRulesData;
console.log(typedOrphanedRulesData);
  for (const orphanedRule of typedOrphanedRulesData) {
    try {
      const ruleData = await client.queries.rule({
        relativePath: `${orphanedRule.uri}/rule.mdx`,
      });

      if (ruleData?.data?.rule) {
        const rule = ruleData.data.rule;
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
  };
}