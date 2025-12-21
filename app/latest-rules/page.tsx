import { Section } from "@/components/layout/section";
import { fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import LatestRuleClientPage from "./client-page";

export const revalidate = 300;

const DEFAULT_SIZE = 10;
const MAX_SIZE = 50;

export default async function LatestRulePage() {
  const [ruleCount, latestRulesByUpdated, latestRulesByCreated] = await Promise.all([
    fetchRuleCount(),
    fetchLatestRules(MAX_SIZE, "lastUpdated", true),
    fetchLatestRules(MAX_SIZE, "created", true),
  ]);

  return (
    <Section>
      <LatestRuleClientPage ruleCount={ruleCount} latestRulesByUpdated={latestRulesByUpdated} latestRulesByCreated={latestRulesByCreated} />
    </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "Latest Rules | SSW.Rules",
    alternates: {
      canonical: `${siteUrl}/latest-rules/`,
    },
  };
}
