import type { Metadata } from "next";
import { siteUrl } from "@/site-config";

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
 * Next does NOT derive og:title from `title`, and a page that sets only `title`
 * silently inherits the layout's generic openGraph block - so every page shared as
 * "SSW.Rules | Secret Ingredients..." regardless of what it actually was. Routing
 * every page through here keeps the three in sync.
 *
 * Deliberately never sets openGraph.images: the opengraph-image.tsx routes supply the
 * card, and setting images here would override the generated one.
 */
export function pageMetadata({ title, description, path = "", type = "website", robots }: PageMetadataOptions): Metadata {
  const url = path ? `${siteUrl}/${path}` : `${siteUrl}/`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type },
    twitter: { card: "summary_large_image", title, description },
    ...(robots ? { robots } : {}),
  };
}
