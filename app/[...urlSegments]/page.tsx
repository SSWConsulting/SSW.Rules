import React from 'react';
import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import ClientPage from './client-page';
import client from '@/tina/__generated__/client';
import { EmailTemplate } from '@/components/blocks/email-template';

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

  const { data } = await client.queries.global({
    relativePath: 'index.json',
  });
  const blocks = data.global.blocks ?? [];

  return (
    <Layout>
      <Section>
        <ClientPage />
        {blocks.map((block, index) => {
          switch (block?.__typename) {
            case 'GlobalBlocksEmailTemplate':
              return <EmailTemplate key={index} data={block} />;
            default:
              return null;
          }
        })}
      </Section>
    </Layout>
  );
}

//TODO: retrieve data with tina client when collections are set up
// export async function generateStaticParams() {
// }
