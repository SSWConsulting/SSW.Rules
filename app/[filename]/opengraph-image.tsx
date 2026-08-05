import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/components/og/card";
import { siteTitle } from "@/site-config";
import client from "@/tina/__generated__/client";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

// Cards only change when a rule's title or author list changes
export const revalidate = 60 * 60 * 24;

export default async function OpengraphImage({ params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  let title = siteTitle;
  let authors: { title?: string | null; url?: string | null }[] = [];

  try {
    const rule = await client.queries.ruleDataBasic({ relativePath: `${filename}/rule.mdx` });
    if (rule?.data?.rule?.title) {
      title = rule.data.rule.title;
      authors = (rule.data.rule.authors ?? []).filter(Boolean) as typeof authors;
    }
  } catch {
    // This route also serves category pages. Resolving a category title needs the
    // paginated topCategoryWithIndexQuery walk that page.tsx does, which is too heavy
    // per-image - categories fall back to the site-title card for now.
  }

  return new ImageResponse(await OgCard({ title, authors }), size);
}
