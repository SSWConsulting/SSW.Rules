import React from "react";
import categoryTitleIndex from "@/category-uri-title-map.json";
import { Section } from "@/components/layout/section";
import { extractBodyPreview } from "@/lib/bodyUtils";
import { pageMetadata } from "@/lib/pageMetadata";
import { getRuleFolders } from "@/lib/ruleFolders";
import { getDiscussionNumberForGuid } from "@/lib/services/github/giscusDiscussions.service";
import client from "@/tina/__generated__/client";
import { CategoryWithRulesQueryDocument } from "@/tina/__generated__/types";
import ClientFallbackPage from "./ClientFallbackPage";
import { TinaCategoryWrapper } from "./TinaCategoryWrapper";
import { TinaRuleWrapper } from "./TinaRuleWrapper";

// We have a Tina webhook revalidating each page individually on change
// Leaving this as a fallback in case the above goes wrong
// export const revalidate = 3600;

export const dynamic = "force-static";

const getFullRelativePathFromFilename = async (filename: string): Promise<string | null> => {
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    let res;
    try {
      res = await client.queries.topCategoryWithIndexQuery({
        first: 50,
        after,
      });
    } catch (err: any) {
      console.warn(`[getFullRelativePathFromFilename] topCategoryWithIndexQuery failed for filename="${filename}":`, err?.message || err);
      return null;
    }

    const topCategories = res?.data?.categoryConnection?.edges || [];
    for (const edge of topCategories) {
      const node = edge?.node;
      if (node?.__typename === "CategoryTop_category") {
        const topRelativePath = node._sys.relativePath;
        const topDir = topRelativePath.replace("/index.mdx", "");

        const children = node.index || [];
        for (const child of children) {
          if (child?.category?._sys?.filename === filename) {
            return `${topDir}/${filename}.mdx`;
          }
        }
      }
    }

    hasNextPage = !!res?.data?.categoryConnection?.pageInfo?.hasNextPage;
    after = res?.data?.categoryConnection?.pageInfo?.endCursor ?? null;
  }

  return null;
};

const getCategoryData = async (filename: string) => {
  const fullPath = await getFullRelativePathFromFilename(filename);
  if (!fullPath) return;

  try {
    // Tina's default client errorPolicy is "throw" which can 500 a whole page if a referenced rule is missing.
    // Using a non-throwing errorPolicy allows us to render the category and simply omit missing rules.
    const res: any = await (client as any).request({
      query: String(CategoryWithRulesQueryDocument),
      variables: { relativePath: `${fullPath}` },
      errorPolicy: "all",
    });

    const errorMessages = (res?.errors ?? [])
      .map((e: any) => (typeof e === "string" ? e : e?.message))
      .filter((m: any): m is string => typeof m === "string" && m.length > 0);

    const missingRecordErrors = errorMessages.filter((m) => m.includes("Unable to find record"));
    if (missingRecordErrors.length > 0) {
      console.warn(`[getCategoryData] Missing rule references in category relativePath="${fullPath}":\n${missingRecordErrors.join("\n")}`);
    }

    if (!res?.data) {
      console.error(`[getCategoryData] returned null for filename="${filename}" relativePath="${fullPath}" errors="${errorMessages.join(" | ")}"`);
      return null;
    }

    return {
      data: res.data,
      query: String(CategoryWithRulesQueryDocument),
      variables: { relativePath: `${fullPath}` },
    };
  } catch (error) {
    console.error(`[getCategoryData] failed for filename="${filename}":`, error);
    return null;
  }
};

export interface BrokenReferences {
  detected: boolean;
  paths: string[];
}

const getRuleData = async (filename: string) => {
  try {
    const basicProps = await client.queries.ruleDataBasic({
      relativePath: filename + "/rule.mdx",
    });

    if (!basicProps?.data?.rule) {
      console.error(`[getRuleData] ruleDataBasic returned no rule for filename="${filename}"`);
    }

    try {
      const fullProps = await client.queries.ruleData({
        relativePath: filename + "/rule.mdx",
      });

      return {
        data: fullProps.data,
        query: fullProps.query,
        variables: fullProps.variables,
        brokenReferences: null as BrokenReferences | null,
      };
    } catch (relatedError) {
      console.warn(
        `[getRuleData] related-rules query failed for filename="${filename}", rendering without related rules:`,
        relatedError instanceof Error ? relatedError.message : relatedError
      );
      const errorMessage = relatedError instanceof Error ? relatedError.message : String(relatedError);

      // Extract all broken paths from error message (there may be multiple)
      const brokenPathMatches = errorMessage.matchAll(/Unable to find record ([^\n]+)/g);
      const brokenPaths = Array.from(brokenPathMatches, (match) => match[1].trim());

      // Fallback if no paths found
      if (brokenPaths.length === 0) {
        brokenPaths.push("unknown path");
      }

      return {
        data: {
          ...basicProps.data,
          rule: {
            ...basicProps.data.rule,
            related: [], // Clear broken related rules
          },
        },
        query: basicProps.query,
        variables: basicProps.variables,
        brokenReferences: {
          detected: true,
          paths: brokenPaths,
        } as BrokenReferences,
      };
    }
  } catch (error) {
    console.error(`[getRuleData] failed for filename="${filename}":`, error);
    return null;
  }
};

export async function generateStaticParams() {
  try {
    if (!client?.queries) {
      console.error("Client or queries not available");
      return [];
    }

    const filenames = new Set<string>(await getRuleFolders());

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
                  allChildCategories.push({ filename: child.category._sys.filename });
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

    // The page finds a category only in the index of a top category, so these children are all the category pages.
    const childCategories = await fetchAllTopCategoriesWithChildren();
    for (const c of childCategories) {
      filenames.add(c.filename);
    }

    const fileCategories = Object.keys((categoryTitleIndex as any).categories || {});
    for (const fn of fileCategories) filenames.add(fn);

    const paths = Array.from(filenames || []).map((filename) => ({ filename }));

    console.log(`🚀 generateStaticParams: rules + categories total=${paths.length}`);
    return paths;
  } catch (error) {
    console.error("Error fetching static params:", error);
    return [];
  }
}

export default async function Page({ params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  const category = await getCategoryData(filename);
  if (category?.data) {
    return (
      <Section>
        <TinaCategoryWrapper
          tinaQueryProps={category}
          serverCategoryPageProps={{
            path: category.variables?.relativePath,
          }}
        />
      </Section>
    );
  }

  const rule = await getRuleData(filename);

  if (rule?.data) {
    const discussionNumber = await getDiscussionNumberForGuid(rule.data.rule?.guid);

    return (
      <Section>
        <TinaRuleWrapper
          tinaQueryProps={rule}
          serverRulePageProps={{
            rule: rule.data.rule,
            brokenReferences: rule.brokenReferences,
            discussionNumber,
          }}
        />
      </Section>
    );
  }

  // If data is not found statically, try fetching on client side with branch support
  console.error(`[ClientFallbackPage] rendering fallback for filename="${filename}" category=null rule=null`);
  return <ClientFallbackPage filename={filename} />;
}

export async function generateMetadata({ params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  try {
    const category = await getCategoryData(filename);
    if (category?.data?.category && category.data.category.__typename === "CategoryCategory") {
      const categoryData = category.data.category as any;
      return pageMetadata({
        title: `${categoryData.title} | SSW.Rules`,
        description: categoryData.seoDescription || undefined,
        path: filename,
      });
    }

    const rule = await getRuleData(filename);
    if (rule?.data?.rule?.title) {
      return pageMetadata({
        title: `${rule.data.rule.title} | SSW.Rules`,
        description: rule.data.rule.seoDescription || extractBodyPreview(rule.data.rule.body) || undefined,
        path: filename,
        type: "article",
        robots: rule.data.rule.isArchived ? { index: false, follow: true } : undefined,
      });
    }
  } catch (error) {
    console.error("Error generating metadata:", error);
  }

  return pageMetadata({ title: "SSW.Rules", path: filename });
}
