import React from "react";
import categoryTitleIndex from "@/category-uri-title-map.json";
import { Section } from "@/components/layout/section";
import { extractBodyPreview } from "@/lib/bodyUtils";
import { pageMetadata } from "@/lib/pageMetadata";
import { getRuleFolders } from "@/lib/ruleFolders";
import { getDiscussionNumberForGuid } from "@/lib/services/github/giscusDiscussions.service";
import client from "@/tina/__generated__/client";
import ClientFallbackPage from "./ClientFallbackPage";
import { getCategoryData, getRuleData } from "./pageData";
import { TinaCategoryWrapper } from "./TinaCategoryWrapper";
import { TinaRuleWrapper } from "./TinaRuleWrapper";

// We have a Tina webhook revalidating each page individually on change
// Leaving this as a fallback in case the above goes wrong
// export const revalidate = 3600;

export const dynamic = "force-static";

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

  // No catch: a Tina error must fail the render like the page does, not cache a page with the default title
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

  return pageMetadata({ title: "SSW.Rules", path: filename });
}
