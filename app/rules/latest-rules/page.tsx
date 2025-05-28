import React from 'react';
import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import ClientLatestRulesPage from './client-page';

export const revalidate = 300;

export default async function RulesSearchPage({
  searchParams,
}: {
  searchParams: { size?: number };
}) {

  const { size = 50 } = await searchParams;
  const layout = await Layout({
    children: (
      <Section>
        <ClientLatestRulesPage size={size} />
      </Section>
    )
  });

  return layout;
}
