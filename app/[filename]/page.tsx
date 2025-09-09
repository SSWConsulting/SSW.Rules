import React from "react";
import Layout from "@/components/layout/layout";
import { Section } from "@/components/layout/section";
import client from "@/tina/__generated__/client";
import ClientCategoryPage from "./client-category-page";
import ClientRulePage from "./client-rule-page";
import { notFound } from "next/navigation";
import ruleToCategoryIndex from '@/rule-to-categories.json'; 
import categoryTitleIndex from '@/category-uri-title-map.json';

export const revalidate = 300;

const getFullRelativePathFromFilename = async (filename: string): Promise<string | null> => {
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    const res = await client.queries.topCategoryWithIndexQuery({
      first: 50,
      after,
    });

    const topCategories = res?.data.categoryConnection?.edges || [];

    for (const edge of topCategories) {
      const node = edge?.node;
      if (node?.__typename === "CategoryTop_category") {
        const topRelativePath = node._sys.relativePath;
        const topDir = topRelativePath.replace("/index.mdx", "");

        const children = node.index || [];
        for (const child of children) {
          // @ts-ignore
          if (child?.category?._sys?.filename === filename) {
            return `${topDir}/${filename}.mdx`;
          }
        }
      }
    }

    hasNextPage = res?.data?.categoryConnection?.pageInfo?.hasNextPage;
    after = res?.data?.categoryConnection?.pageInfo?.endCursor;
  }

  return null;
};

const getCategoryData = async (filename: string) => {
  const fullPath = await getFullRelativePathFromFilename(filename);
  if (!fullPath) return

  try {
    const res = await client.queries.categoryWithRulesQuery({
      relativePath: `${fullPath}`,
    })

    return {
      data: res.data,
      query: res.query,
      variables: res.variables
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
    if (!client?.queries) {
      console.error("Client or queries not available");
      return [];
    }

    const [categoryConnection, ruleConnection] = await Promise.all([
      client.queries.categoryConnection().catch((err) => {
        const isRecordNotFound = err?.message?.includes('Unable to find record');
        if (!isRecordNotFound) {
          console.warn("Error fetching categories:", err?.message || err);
        }
        return { data: { categoryConnection: { edges: [] } } };
      }),
      client.queries.ruleConnection().catch((err) => {
        const isRecordNotFound = err?.message?.includes('Unable to find record');
        if (!isRecordNotFound) {
          console.warn("Error fetching rules:", err?.message || err);
        }
        return { data: { ruleConnection: { edges: [] } } };
      }),
    ]);

    if (!categoryConnection?.data && !ruleConnection?.data) {
      console.error("Failed to fetch any valid connections data");
      return [];
    }

    const rules: { filename: string }[] = [];
    if (ruleConnection?.data?.ruleConnection?.edges && Array.isArray(ruleConnection.data.ruleConnection.edges)) {
      for (const page of ruleConnection.data.ruleConnection.edges) {
        try {
          if (page?.node?._sys?.filename === "rule" && page?.node?._sys?.relativePath) {
            const relativePath = page.node._sys.relativePath;
            const pathParts = relativePath.split("/");
            if (pathParts.length > 0 && pathParts[0]) {
              rules.push({ filename: pathParts[0] });
            }
          }
        } catch (err) {
          console.warn("Error processing rule page:", err);
        }
      }
    }

    const categories: { filename: string }[] = [];
    if (categoryConnection?.data?.categoryConnection?.edges && Array.isArray(categoryConnection.data.categoryConnection.edges)) {
      for (const page of categoryConnection.data.categoryConnection.edges) {
        try {
          if (page?.node?._sys?.filename && page.node._sys.filename !== "index") {
            categories.push({ filename: page.node._sys.filename });
          }
        } catch (err) {
          console.warn("Error processing category page:", err);
        }
      }
    }

    const paths = [...rules, ...categories];

    if (paths.length === 0) {
      console.warn("No static params generated - no valid rules or categories found");
    }

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
  const ruleCategories = ruleUri ? ruleToCategoryIndex[ruleUri] : undefined;

  const ruleCategoriesMapping = ruleCategories?.map((categoryUri: string) => {
    return {
      title: categoryTitleIndex.categories[categoryUri],
      uri: categoryUri,
    }
  })|| [];

  // Build related rules mapping (uri -> title)
  let relatedRulesMapping: { uri: string; title: string }[] = [];
  try {
    const relatedUris = (rule?.data?.rule?.related || []).filter((u): u is string => typeof u === 'string' && u.length > 0);
    if (relatedUris.length) {
      const uris = Array.from(new Set(relatedUris));
      const res = await client.queries.rulesByUriQuery({ uris });
      const edges = res?.data?.ruleConnection?.edges ?? [];
      relatedRulesMapping = edges
        .map((e: any) => e?.node)
        .filter(Boolean)
        .map((n: any) => ({ uri: n.uri as string, title: n.title as string }))
        .sort((a, b) => a.title.localeCompare(b.title));
    }
  } catch (e) {
    console.error('Error loading related rules:', e);
  }

  if (rule?.data) {
    return (
      <Layout>
        <Section>
          <ClientRulePage ruleQueryProps={rule} ruleCategoriesMapping={ruleCategoriesMapping} relatedRulesMapping={relatedRulesMapping} />
        </Section>
      </Layout>
    );
  }

  notFound();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ filename: string }>;
}) {
  const { filename } = await params;

  try {
    const category = await getCategoryData(filename);
    if (category?.data?.category && "title" in category.data.category) {
      return {
        title: `${category.data.category.title} | SSW.Rules`,
      };
    }

    const rule = await getRuleData(filename);
    if (rule?.data?.rule?.title) {
      return {
        title: `${rule.data.rule.title} | SSW.Rules`,
      };
    }
  } catch (error) {
    console.error("Error generating metadata:", error);
  }

  return {
    title: "SSW.Rules",
  };
}