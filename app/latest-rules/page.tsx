import { Section } from '@/components/layout/section';
import LatestRuleClientPage from './client-page';
import { fetchRuleCount } from '@/lib/services/rules';
import { Suspense } from 'react';
import Spinner from '@/components/Spinner';

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

  const ruleCount = await fetchRuleCount();

  return (
      <Section>
        <Suspense fallback={<Spinner size="lg" />}>
          <LatestRuleClientPage
            ruleCount={ruleCount}
            initialSize={size}
          />
        </Suspense>
      </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "Latest Rules | SSW.Rules",
  }
}