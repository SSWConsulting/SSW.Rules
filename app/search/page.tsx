import Layout from "@/components/layout/layout";
import { Section } from "@/components/layout/section";
import RulesSearchClientPage from "./client-page";
import { Suspense } from "react";
import { fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";

export const revalidate = 300;

export default async function RulesSearchPage() {
  const [latestRulesByUpdated, ruleCount] = await Promise.all([
    fetchLatestRules(5, "lastUpdated"),
    fetchRuleCount(),
  ]);

  return (
      <Section>
        <Suspense fallback={null}>
          <RulesSearchClientPage
            ruleCount={ruleCount}
            latestRulesByUpdated={latestRulesByUpdated}
          />
        </Suspense>
      </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "SSW.Rules | Secret Ingredients for Quality Software (Open Source on GitHub)",
    alternates: {
      canonical: `${siteUrl}/search`,
    },
  }
}