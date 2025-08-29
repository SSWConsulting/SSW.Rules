import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import UserRulesClientPage from './client-page';
import { Suspense } from "react";

export const revalidate = 300;

export default function UserRulesPage() {
  return (
    <Layout>
      <Section>
        <Suspense fallback={null}>
          <UserRulesClientPage />
        </Suspense>
      </Section>
    </Layout>
  );
}