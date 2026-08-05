import { unstable_cache } from "next/cache";
import client from "@/tina/__generated__/client";

export interface OgAuthor {
  title?: string | null;
  url?: string | null;
}

export type OgTarget = { kind: "rule"; title: string; authors: OgAuthor[] } | { kind: "category"; title: string } | { kind: "unknown" };

/**
 * Category titles keyed by URL filename. mainCategoryQuery returns every category in
 * one un-paginated call, avoiding the pagination walk page.tsx needs for a full
 * relativePath. Top categories are skipped - they live at <dir>/index.mdx so their
 * filename is always "index" and never matches a URL segment.
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
  { tags: ["category-rule-data"] }
);

/**
 * Dispatches on the result, not on a thrown query: Tina throws identically for "no such
 * record" and "network is down", so treating a throw as "must be a category" would ship
 * a hub card titled "SSW.Rules" for a real rule and cache it for a day.
 */
export async function resolveOgTarget(filename: string): Promise<OgTarget> {
  try {
    const rule = await client.queries.ruleDataBasic({ relativePath: `${filename}/rule.mdx` });
    if (rule?.data?.rule?.title) {
      return {
        kind: "rule",
        title: rule.data.rule.title,
        authors: (rule.data.rule.authors ?? []).filter(Boolean) as OgAuthor[],
      };
    }
  } catch {
    // Not a rule, or Tina is unwell. Either way the category lookup decides next.
  }

  try {
    const title = (await getCategoryTitles())[filename];
    if (title) return { kind: "category", title };
  } catch {
    // Categories failed too - treat as unknown rather than guessing at a card
  }

  return { kind: "unknown" };
}
