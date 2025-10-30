import React from "react";
import { Section } from "@/components/layout/section";
import client from "@/tina/__generated__/client";
import { notFound } from "next/navigation";
import ruleToCategoryIndex from "@/rule-to-categories.json";
import categoryTitleIndex from "@/category-uri-title-map.json";
import ServerCategoryPage from "@/app/[filename]/ServerCategoryPage";
import { TinaRuleWrapper } from "./TinaRuleWrapper";

export const revalidate = 3600;
export const dynamicParams = false;

// Add this to force static generation - ensure that the getRuleData and getCategoryData 
// functions are called at build time and have them cached.

export const dynamic = 'force-static';

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
  if (!fullPath) return;

  try {
    const res = await client.queries.categoryWithRulesQuery({
      relativePath: `${fullPath}`,
    });

    return {
      data: res.data,
      query: res.query,
      variables: res.variables,
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

    // Helper function to fetch all pages from a connection
    const fetchAllPages = async (queryFunction: (args?: any) => Promise<any>, queryName: string) => {
      const allEdges: any[] = [];
      let hasNextPage = true;
      let after: string | null = null;

      while (hasNextPage) {
        try {
          const result = await queryFunction({ first: 50, after }).catch((err) => {
            const isRecordNotFound = err?.message?.includes("Unable to find record");
            if (!isRecordNotFound) {
              console.warn(`Error fetching ${queryName}:`, err?.message || err);
            }
            return { data: { [`${queryName}Connection`]: { edges: [], pageInfo: { hasNextPage: false } } } };
          });

          const connection = result?.data?.[`${queryName}Connection`];
          if (connection?.edges && Array.isArray(connection.edges)) {
            allEdges.push(...connection.edges);
          }

          hasNextPage = connection?.pageInfo?.hasNextPage || false;
          after = connection?.pageInfo?.endCursor || null;
        } catch (err) {
          console.warn(`Error fetching ${queryName} page:`, err);
          hasNextPage = false;
        }
      }

      return allEdges;
    };

    // Helper function to fetch all top categories with their child categories (same logic as getFullRelativePathFromFilename)
    const fetchAllTopCategoriesWithChildren = async () => {
      const allChildCategories: { filename: string }[] = [];
      let hasNextPage = true;
      let after: string | null = null;

      while (hasNextPage) {
        try {
          const res = await client.queries.topCategoryWithIndexQuery({
            first: 50,
            after,
          });

          const topCategories = res?.data.categoryConnection?.edges || [];

          for (const edge of topCategories) {
            const node = edge?.node;
            if (node?.__typename === "CategoryTop_category") {
              const children = node.index || [];
              for (const child of children) {
                if (child?.category?.__typename === "CategoryCategory" && child?.category?._sys?.filename) {
                  allChildCategories.push({
                    filename: child.category._sys.filename,
                  });
                }
              }
            }
          }

          hasNextPage = res?.data?.categoryConnection?.pageInfo?.hasNextPage;
          after = res?.data?.categoryConnection?.pageInfo?.endCursor;
        } catch (err) {
          console.warn("Error fetching top categories with children:", err);
          hasNextPage = false;
        }
      }

      return allChildCategories;
    };

    // Fetch all categories, rules, and child categories with pagination
    const [allCategoryEdges, allRuleEdges, childCategories] = await Promise.all([
      fetchAllPages(client.queries.categoryConnection, "category"),
      fetchAllPages(client.queries.ruleConnection, "rule"),
      fetchAllTopCategoriesWithChildren(),
    ]);

    if (allCategoryEdges.length === 0 && allRuleEdges.length === 0 && childCategories.length === 0) {
      console.error("Failed to fetch any valid connections data");
      return [];
    }

    const rules: { filename: string }[] = [];
    for (const page of allRuleEdges) {
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

    const categories: { filename: string }[] = [];
    for (const page of allCategoryEdges) {
      try {
        if (page?.node?._sys?.filename && page.node._sys.filename !== "index") {
          categories.push({ filename: page.node._sys.filename });
        }
      } catch (err) {
        console.warn("Error processing category page:", err);
      }
    }

    const fileCategories: { filename: string }[] = Object.keys(
      (categoryTitleIndex as any).categories || {}
    ).map((uri) => ({ filename: uri }));

    // Combine all paths: rules, direct categories, child categories, and local file categories
    const all = [...rules, ...categories, ...childCategories, ...fileCategories];

    const paths = Array.from(new Map(all.map((i) => [i.filename, i])).values());

    console.log(
      `🚀 ~ generateStaticParams ~ Generated ${paths.length} paths ` +
        `(rules=${rules.length}, categories=${categories.length}, childCategories=${childCategories.length}, fileCats=${fileCategories.length})`
    );

    return paths;
  } catch (error) {
    console.error("Error fetching static params:", error);
    return [];
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ filename: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { filename } = await params;

  const category = await getCategoryData(filename);
  if (category?.data) {
    const sp = (await searchParams) ?? {};
    const includeArchived = String(sp.archived ?? "") === "true";
    const view = String(sp.view ?? "blurb") as "titleOnly" | "blurb" | "all";
    const page = Math.max(1, parseInt(String(sp.page ?? "1"), 10) || 1);
    const perPage = Math.max(1, Math.min(50, parseInt(String(sp.perPage ?? "10"), 10) || 10));

    return (
      <Section>
        <ServerCategoryPage
          category={category.data.category}
          path={category.variables?.relativePath}
          includeArchived={includeArchived}
          view={view}
          page={page}
          perPage={perPage}
        />
      </Section>
    );
  }

  const rule = await getRuleData(filename);
  const ruleUri = rule?.data.rule.uri;
  const ruleCategories = ruleUri ? (ruleToCategoryIndex as Record<string, string[]>)[ruleUri] : undefined;

  const ruleCategoriesMapping =
    ruleCategories?.map((categoryUri: string) => {
      return {
        title: (categoryTitleIndex as any).categories[categoryUri],
        uri: categoryUri,
      };
    }) || [];

  // Build related rules mapping (uri -> title)
  let relatedRulesMapping: { uri: string; title: string }[] = [];
  try {
    const relatedUris = (rule?.data?.rule?.related || []).filter(
      (u): u is string => typeof u === "string" && u.length > 0
    );
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
    console.error("Error loading related rules:", e);
  }

  if (rule?.data) {
    const sanitizedBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/^\/+/, "");
    return (
      <Section>
        <TinaRuleWrapper
          tinaQueryProps={rule}
          serverRulePageProps={{
            rule: rule.data.rule,
            ruleCategoriesMapping: ruleCategoriesMapping,
            relatedRulesMapping: relatedRulesMapping,
            sanitizedBasePath: sanitizedBasePath,
          }}
        />
      </Section>
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
