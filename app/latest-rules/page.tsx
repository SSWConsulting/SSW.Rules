import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import LatestRuleClientPage from './client-page';
import { fetchLatestRules, fetchRuleCount } from '@/lib/services/rules';

export const revalidate = 300;

interface LatestRulePageProps {
  searchParams: Promise<{ size?: string }>;
}

export default async function LatestRulePage({ searchParams }: LatestRulePageProps) {
  const { size: sizeStr } = await searchParams;

  const size = sizeStr ? parseInt(sizeStr, 10) : 5;

  const [latestRulesByUpdated, latestRulesByCreated, ruleCount] = await Promise.all([
    fetchLatestRules(size, "lastUpdated"),
    fetchLatestRules(size, "created"),
    fetchRuleCount(),
  ]);

  return (
    <Layout>
      <Section>
        <LatestRuleClientPage 
          ruleCount={ruleCount}
          latestRulesByUpdated={latestRulesByUpdated}
          latestRulesByCreated={latestRulesByCreated}
        />
      </Section>
    </Layout>
  );
}

export async function generateMetadata() {
  return {
    title: "Latest Rules | SSW.Rules",
  }
}