import { Section } from '@/components/layout/section';
import LatestRuleClientPage from './client-page';
import { fetchLatestRules, fetchRuleCount } from '@/lib/services/rules';

export const revalidate = 300;

interface LatestRulePageProps {
  searchParams: Promise<{ size?: string }>;
}

const DEFAULT_SIZE = 5;
const MAX_SIZE = 50;

export default async function LatestRulePage({ searchParams }: LatestRulePageProps) {
  const { size: sizeStr } = await searchParams;

  let size = sizeStr ? parseInt(sizeStr, 10) : DEFAULT_SIZE;
  if (isNaN(size) || size <= 0) {
    size = DEFAULT_SIZE;
  } else if (size > MAX_SIZE) {
    size = MAX_SIZE;
  }

  const [latestRulesByUpdated, latestRulesByCreated, ruleCount] = await Promise.all([
    fetchLatestRules(size, "lastUpdated"),
    fetchLatestRules(size, "created"),
    fetchRuleCount(),
  ]);

  return (
      <Section>
        <LatestRuleClientPage 
          ruleCount={ruleCount}
          latestRulesByUpdated={latestRulesByUpdated}
          latestRulesByCreated={latestRulesByCreated}
        />
      </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "Latest Rules | SSW.Rules",
  }
}