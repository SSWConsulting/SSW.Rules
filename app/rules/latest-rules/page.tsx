import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import LatestRuleClientPage from './client-page';

export const revalidate = 300;

export default function LatestRulePage() {
  return (
    <Layout>
      <Section>
        <LatestRuleClientPage />
      </Section>
    </Layout>
  );
}
