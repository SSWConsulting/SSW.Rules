import React from 'react';
import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import RulesSearchClient from '@/components/RulesSearchClient';

export const revalidate = 300;

export default async function RulesSearchPage({
  searchParams,
}: {
  searchParams: { keyword?: string };
}) {

      const { keyword = '' } = await searchParams;
  const layout = await Layout({
    children: (
      <Section>
        <RulesSearchClient keyword={keyword} />
      </Section>
    )
  });

  return layout;
}
