import { Suspense } from "react";
import { Section } from "@/components/layout/section";
import { pageMetadata } from "@/lib/pageMetadata";
import { fetchHomepageData, fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";
import { homepageTitle, siteTitle } from "@/site-config";
import RulesSearchClientPage from "./client-page";

export const revalidate = 300;

export default async function RulesSearchPage() {
  const [latestRulesByUpdated, ruleCount, homepageData] = await Promise.all([fetchLatestRules(5, "lastUpdated"), fetchRuleCount(), fetchHomepageData()]);

  return (
    <Section>
      <Suspense fallback={null}>
        <RulesSearchClientPage ruleCount={ruleCount} latestRulesByUpdated={latestRulesByUpdated} helpImprove={homepageData?.data.homepage.helpImprove} />
      </Suspense>
    </Section>
  );
}

export async function generateMetadata() {
  return pageMetadata({ title: `${siteTitle} | ${homepageTitle}`, path: "search" });
}
