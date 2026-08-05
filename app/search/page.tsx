import { Suspense } from "react";
import { Section } from "@/components/layout/section";
import { pageMetadata } from "@/lib/pageMetadata";
import { fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";
import RulesSearchClientPage from "./client-page";

export const revalidate = 300;

export default async function RulesSearchPage() {
  const [latestRulesByUpdated, ruleCount] = await Promise.all([fetchLatestRules(5, "lastUpdated"), fetchRuleCount()]);

  return (
    <Section>
      <Suspense fallback={null}>
        <RulesSearchClientPage ruleCount={ruleCount} latestRulesByUpdated={latestRulesByUpdated} />
      </Suspense>
    </Section>
  );
}

export async function generateMetadata() {
  return pageMetadata({ title: "SSW.Rules | Secret Ingredients for Quality Software (Open Source on GitHub)", path: "search" });
}
