import { Section } from "@/components/layout/section";
import { fetchLatestRules, fetchRuleCount } from "@/lib/services/rules";
import { siteUrl } from "@/site-config";
import LatestRuleClientPage from "./client-page";

export const revalidate = 300;

const DEFAULT_SIZE = 50;
const MAX_SIZE = 50;

type LatestRulePageProps = {
  searchParams?: Promise<{ size?: string | string[] }>;
};

export default async function LatestRulePage({ searchParams }: LatestRulePageProps) {
  const sp = (await searchParams) ?? {};
  const sizeRaw = sp.size;
  const sizeStr = Array.isArray(sizeRaw) ? sizeRaw[0] : sizeRaw;

  let size = sizeStr ? parseInt(sizeStr, 10) : DEFAULT_SIZE;

  if (!Number.isFinite(size) || Number.isNaN(size) || size <= 0) {
    size = DEFAULT_SIZE;
  } else if (size > MAX_SIZE) {
    size = MAX_SIZE;
  }

  const [ruleCount, latestRulesByUpdated, latestRulesByCreated] = await Promise.all([
    fetchRuleCount(),
    fetchLatestRules(size, "lastUpdated", true),
    fetchLatestRules(size, "created", true),
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
      canonical: `${siteUrl}/latest-rules`,
    },
  };
}
