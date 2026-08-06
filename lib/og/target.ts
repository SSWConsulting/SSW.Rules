import { unstable_cache } from "next/cache";
import client from "@/tina/__generated__/client";

export interface OgAuthor {
  title?: string | null;
  url?: string | null;
}

export type OgTarget = { kind: "rule"; title: string; authors: OgAuthor[] } | { kind: "category"; title: string } | { kind: "generic" };

/**
 * Category titles keyed by URL filename. mainCategoryQuery returns every category in
 * one un-paginated call, avoiding the pagination walk page.tsx needs for a full
 * relativePath. Top categories are skipped - they live at <dir>/index.mdx so their
 * filename is always "index" and never matches a URL segment.
 *
 * Tagged with rule-count as well as category-rule-data because the Tina webhook only
 * fires the former.
 */
const getCategoryTitles = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const res = await client.queries.mainCategoryQuery();
    const titles: Record<string, string> = {};

    for (const entry of (res?.data?.category as any)?.index ?? []) {
      for (const child of entry?.top_category?.index ?? []) {
        const filename = child?.category?._sys?.filename;
        if (filename && child.category.title) titles[filename] = child.category.title;
      }
    }

    return titles;
  },
  ["og-category-titles"],
  { tags: ["category-rule-data", "rule-count"], revalidate: 60 * 60 * 24 }
);

/**
 * Resolves a URL segment to a rule, a category, or neither. Category first, matching
 * page.tsx's precedence, so the card and the page cannot disagree about what a
 * filename is.
 *
 * Anything unresolved returns "generic" rather than 404ing. page.tsx serves every
 * unresolved filename via ClientFallbackPage, so a 404 here would mean a live page
 * with a broken og:image - and a Tina outage is indistinguishable from a genuine miss
 * anyway, because the category map is cached and will not throw when it is warm.
 */
export async function resolveOgTarget(filename: string): Promise<OgTarget> {
  try {
    const title = (await getCategoryTitles())[filename];
    if (title) return { kind: "category", title };
  } catch (error) {
    console.warn(`[og] category lookup failed for "${filename}":`, error);
  }

  try {
    const rule = await client.queries.ruleDataBasic({ relativePath: `${filename}/rule.mdx` });
    if (rule?.data?.rule?.title) {
      return {
        kind: "rule",
        title: rule.data.rule.title,
        authors: (rule.data.rule.authors ?? []).filter(Boolean) as OgAuthor[],
      };
    }
  } catch (error) {
    // Tina throws for a missing record as well as for an outage, so this is only worth
    // a debug line - a genuine miss is normal traffic.
    console.debug(`[og] no rule for "${filename}":`, error);
  }

  return { kind: "generic" };
}
