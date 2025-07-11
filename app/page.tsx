import React from 'react';
import { Section } from '@/components/layout/section';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import SearchBar from '@/components/SearchBar';
import HomeClientPage from './client-page';

export const revalidate = 300;

async function fetchAllCategories() {
  let hasNextPage = true;
  let after: string | null = null;
  const allCategories: any[] = [];

  while (hasNextPage) {
    const res = await client.queries.homepageCategoriesQuery({
      first: 50,
      after,
    });

    const edges = res?.data?.categoryConnection?.edges || [];

    allCategories.push(
      ...edges
        .filter((edge: any) => edge && edge.node)
        .map((edge: any) => edge.node)
    );

    hasNextPage = res?.data?.categoryConnection?.pageInfo?.hasNextPage;
    after = res?.data?.categoryConnection?.pageInfo?.endCursor;
  }

  return allCategories;
}

export default async function Home() {
  const categories = await fetchAllCategories();

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