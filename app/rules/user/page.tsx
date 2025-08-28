import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import UserRulesClientPage from './client-page';

export const revalidate = 300;

export default function UserRulesPage() {
  return (
    <Layout>
      <Section>
        <UserRulesClientPage />
      </Section>
    </Layout>
  );
}