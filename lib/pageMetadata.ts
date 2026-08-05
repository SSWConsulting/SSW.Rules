import type { Metadata } from "next";
import { siteTitle, siteUrl, social } from "@/site-config";

interface PageMetadataOptions {
  title: string;
  description?: string;
  /** Path below the site root, e.g. "latest-rules". Omit for the home page. */
  path?: string;
  /** "article" for individual rules, "website" for everything else. */
  type?: "website" | "article";
  robots?: Metadata["robots"];
}

/**
 * Builds a page's metadata with matching og: and twitter: tags.
 *
 * Next does not derive og:title from `title`, and does not deep-merge: a page setting
 * `openGraph` replaces the layout's wholesale, so siteName/locale/handles are repeated
 * here rather than inherited. Never sets openGraph.images - the opengraph-image routes
 * supply the card, and Next only merges it when openGraph has no `images` key.
 */
export function pageMetadata({ title, description, path = "", type = "website", robots }: PageMetadataOptions): Metadata {
  const url = path ? `${siteUrl}/${path}` : `${siteUrl}/`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type, siteName: siteTitle, locale: "en_AU" },
    twitter: { card: "summary_large_image", title, description, site: `@${social.twitter}`, creator: `@${social.twitter}` },
    ...(robots ? { robots } : {}),
  };
}
