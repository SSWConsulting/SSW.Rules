import React from "react";
import Layout from "@/components/layout/layout";
import { Section } from "@/components/layout/section";
import client from "@/tina/__generated__/client";
import ClientCategoryPage from "./client-category-page";
import ClientRulePage from "./client-rule-page";
import { notFound } from "next/navigation";

export const revalidate = 300;

const getCategoryData = async (filepath: string) => {
  const tinaProps = await client.queries.categoryConnection();
  const categories =
    tinaProps.data.categoryConnection.edges?.map((edge: any) => edge.node) ||
    [];

  const category = categories.find((cat: any) => {
    return cat._sys.filename === filepath;
  });

  return {
    data: category,
    query: tinaProps.query,
    variables: tinaProps.variables,
  };
};

const getRuleData = async (filepath: string) => {
  const tinaProps = await client.queries.rule({
    relativePath: filepath + ".mdx",
  });

  return {
    data: tinaProps.data,
    query: tinaProps.query,
    variables: tinaProps.variables,
  };
};

export async function generateStaticParams() {
  const categoryConnection = await client.queries.categoryConnection();
  return categoryConnection.data.categoryConnection.edges?.map((page) => ({
    filename: page?.node?._sys.filename,
  }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ filename: string }>;
}) {
  const { filename } = await params;
  const category = await getCategoryData(filename);

  let rule;
  if (!category?.data) {
    rule = await getRuleData(filename);
  }

  if (!category?.data && !rule?.data) {
    notFound();
  }

  return (
    <Layout>
      <Section>
        {category?.data != null ? (
          <ClientCategoryPage categoryQueryProps={category} />
        ) : (
          <ClientRulePage ruleQueryProps={rule} />
        )}
      </Section>
    </Layout>
  );
}
