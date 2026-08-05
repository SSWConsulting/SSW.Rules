import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/components/og/card";
import { fetchCategoryRuleCounts } from "@/lib/services/rules";
import { siteTitle } from "@/site-config";
import client from "@/tina/__generated__/client";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

// Cards only change when a rule's title or author list changes
export const revalidate = 60 * 60 * 24;

/**
 * Looks up a category title by filename.
 *
 * mainCategoryQuery returns every top category and child category with its title and
 * filename in a single un-paginated call, so this avoids the topCategoryWithIndexQuery
 * pagination walk that page.tsx has to do to resolve a full relativePath.
 */
const categoryTitle = async (filename: string): Promise<string | null> => {
  const res = await client.queries.mainCategoryQuery();
  const topCategories = (res?.data?.category as any)?.index ?? [];

  for (const entry of topCategories) {
    const top = entry?.top_category;
    if (!top) continue;
    if (top._sys?.filename === filename) return top.title ?? null;

    for (const child of top.index ?? []) {
      if (child?.category?._sys?.filename === filename) return child.category.title ?? null;
    }
  }

  return null;
};

export default async function OpengraphImage({ params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  let title = siteTitle;
  let authors: { title?: string | null; url?: string | null }[] = [];
  let ruleCount: number | undefined;

  try {
    const rule = await client.queries.ruleDataBasic({ relativePath: `${filename}/rule.mdx` });
    if (rule?.data?.rule?.title) {
      title = rule.data.rule.title;
      authors = (rule.data.rule.authors ?? []).filter(Boolean) as typeof authors;
    }
  } catch {
    // This route serves category pages too. They have no authors, so they get the
    // hub treatment instead - bigger title, and the rule count carrying the weight.
    try {
      title = (await categoryTitle(filename)) ?? siteTitle;
      ruleCount = (await fetchCategoryRuleCounts())[filename] ?? 0;
    } catch {
      // Fall back to the site title rather than failing the image
    }
  }

  return new ImageResponse(await OgCard({ title, authors, ruleCount }), size);
}
