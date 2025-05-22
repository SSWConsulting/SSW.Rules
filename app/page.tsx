import React from 'react';
import { Section } from '@/components/layout/section';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import SearchBar from '@/components/SearchBar';
import HomeClientPage from './client-page';

export const revalidate = 300;

export default async function Home() {
  const categoriesConnectionData = await client.queries.categoryConnection({
    first: 500
  });
  const categories =
    categoriesConnectionData.data.categoryConnection.edges?.map(
      (edge: any) => edge.node
    ) || [];

  const layout = await Layout({
    children: (
      <Section>
        <SearchBar />
        <HomeClientPage categories={categories} />
      </Section>
    )
  });

  return layout;
}
