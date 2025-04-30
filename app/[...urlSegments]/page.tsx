import React from 'react';
import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import ClientPage from './client-page';

export const revalidate = 300;

export default async function Page({
  params,
}: {
  params: Promise<{ urlSegments: string[] }>;
}) {
  const resolvedParams = await params;
  const filepath = resolvedParams.urlSegments.join('/');
  console.log('filepath', filepath);

//TODO: check if filepath is a rule or category and return the correct component

  return (
    <Layout>
      <Section>
        <ClientPage />
      </Section>
    </Layout>
  );
}

//TODO: retrieve data with tina client when collections are set up
// export async function generateStaticParams() {
// }