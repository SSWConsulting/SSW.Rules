import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import UserRulesClientPage from './client-page';
import { Suspense } from "react";
import { fetchRuleCount } from '@/lib/services/rules';
import { siteUrl } from '@/site-config';

export const revalidate = 300;

export default async function UserRulesPage() {

  const ruleCount = await fetchRuleCount()

  return (
      <Section>
        <Suspense fallback={null}>
          <UserRulesClientPage ruleCount={ruleCount} />
        </Suspense>
      </Section>
  );
}

export async function generateMetadata() {
  return {
    title: "My Rules | SSW.Rules",
    alternates: {
      canonical: `${siteUrl}/user`,
    },
  };
}
