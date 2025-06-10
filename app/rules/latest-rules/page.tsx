import React from 'react';
import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import ClientLatestRulesPage from './client-page';

export const revalidate = 300;

export default async function RulesSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ size?: number }>;
}) {

  //TODO: fix- cant use await searchParams in server component
  // const { size = 50 } = await searchParams;
  const layout = await Layout({
    children: (
      <Section>
        <ClientLatestRulesPage size={50} />
      </Section>
    )
  });

  return layout;
}
