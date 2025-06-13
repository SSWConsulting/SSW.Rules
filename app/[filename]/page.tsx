import React from "react";
import Layout from "@/components/layout/layout";
import { Section } from "@/components/layout/section";
import client from "@/tina/__generated__/client";
import ClientCategoryPage from "./client-category-page";
import ClientRulePage from "./client-rule-page";
import { notFound } from "next/navigation";
import categoriesss from '@/rule-category-mapping.json'; 

export const revalidate = 300;

const getCategoryData = async (filename: string) => {
  try {
    const tinaProps = await client.queries.categoryConnection();
    const categories =
      tinaProps.data.categoryConnection.edges?.map((edge: any) => edge.node) ||
      [];
    const category = categories.find((cat: any) => {
      return cat._sys.filename === filename;
    });

    return {
      data: category,
      query: tinaProps.query,
      variables: tinaProps.variables,
    };
  } catch (error) {
    console.error("Error fetching category data:", error);
    return null;
  }
};

const getRuleData = async (filename: string) => {
  try {
    const tinaProps = await client.queries.rule({
      relativePath: filename + "/rule.mdx",
    });

    return {
      data: tinaProps.data,
      query: tinaProps.query,
      variables: tinaProps.variables,
    };
  } catch (error) {
    console.error("Error fetching rule data:", error);
    return null;
  }
};

export async function generateStaticParams() {
  try {
    const [categoryConnection, ruleConnection] = await Promise.all([
      client.queries.categoryConnection(),
      client.queries.ruleConnection(),
    ]);

    const rules =
      ruleConnection.data.ruleConnection.edges?.map((page) => ({
        filename: page?.node?._sys.relativePath.split("/")[0],
      })) || [];

    const categories =
      categoryConnection.data.categoryConnection.edges
        ?.filter((page) => page?.node?._sys.filename !== "index")
        .map((page) => ({
          filename: page?.node?._sys.filename,
        })) || [];

    const paths = [...rules, ...categories];

    return paths;
  } catch (error) {
    console.error("Error fetching static params:", error);
    return [];
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ filename: string }>;
}) {
  const { filename } = await params;

  const category = await getCategoryData(filename);
  if (category?.data) {
    return (
      <Layout>
        <Section>
          <ClientCategoryPage categoryQueryProps={category}/>
        </Section>
      </Layout>
    );
  }

  const rule = await getRuleData(filename);
  const ruleUri = rule?.data.rule.uri;
  const ruleCategories = ruleUri ? categoriesss[ruleUri] : undefined;

  if (rule?.data) {
    return (
      <Layout>
        <Section>
          <ClientRulePage ruleQueryProps={rule} ruleCategories={ruleCategories} />
        </Section>
      </Layout>
    );
  }

  notFound();
}
