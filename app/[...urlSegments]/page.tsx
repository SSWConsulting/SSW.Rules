import React from "react";
import Layout from "@/components/layout/layout";
import { Section } from "@/components/layout/section";
import client from "@/tina/__generated__/client";
import ClientCategoryPage from "./client-category-page";
import ClientRulePage from "./client-rule-page";
import { notFound } from "next/navigation";

export const revalidate = 300;

export default async function Page({
  params,
}: {
  params: Promise<{ urlSegments: string[] }>;
}) {
  const resolvedParams = await params;
  const filepath = resolvedParams.urlSegments.join("/");

  let categoryQueryProps;
  let categoryRules;
  let ruleQueryProps;

  try {
    categoryQueryProps = await client.queries.category({
      relativePath: filepath + ".md",
    });

    //TODO: find a better way to retrieve rules for a category
    const rules = await client.queries.ruleConnection({});
    categoryRules = rules.data.ruleConnection.edges
      ?.filter((rule: any) => {
        return rule.node.categories.some((cat: any) => {
          return (
            categoryQueryProps.data.category._sys.filename === cat.category._sys.filename
          );
        });
      })
      .map((rule: any) => rule.node);
  } catch (error) {
    try {
      ruleQueryProps = await client.queries.rule({
        relativePath: filepath + ".mdx",
      });
    } catch (error) {
      console.log("error", error);
      notFound();
    }
  }

  // const { data } = await client.queries.global({
  //   relativePath: "index.json",
  // });
  // const blocks = data.global.blocks ?? [];

  return (
    <Layout>
      <Section>
        {categoryQueryProps != null ? (
          <ClientCategoryPage categoryQueryProps={categoryQueryProps} rules={categoryRules} />
        ) : (
          <ClientRulePage ruleQueryProps={ruleQueryProps} />
        )}
        {/* {blocks.map((block, index) => {
          switch (block?.__typename) {
            case 'GlobalBlocksEmailTemplate':
              return <EmailTemplate key={index} data={block} />;
            default:
              return null;
          }
        })} */}
      </Section>
    </Layout>
  );
}

//TODO: retrieve data with tina client when collections are set up
// export async function generateStaticParams() {
// }
