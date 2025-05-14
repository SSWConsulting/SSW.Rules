import React from 'react';
import { Section } from '@/components/layout/section';
import client from '@/tina/__generated__/client';
import PageContent from '@/components/PageContent';
import Layout from '@/components/layout/layout';

export const revalidate = 300;

export default async function Home() {
  const categoriesConnectionData = await client.queries.categoryConnection({});
  const categories =
    categoriesConnectionData.data.categoryConnection.edges?.map(
      (edge: any) => edge.node
    ) || [];

  const layout = await Layout({
    children: (
      <Section>
        <PageContent categories={categories} />
      </Section>
    )
  });

  return layout;
}
