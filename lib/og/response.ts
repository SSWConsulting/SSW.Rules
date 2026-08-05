import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/og/card";
import { loadFonts } from "@/lib/og/images";

/**
 * ImageResponse defaults to `public, immutable, no-transform, max-age=31536000`
 * (next/dist/server/og/image-response.js). The image URL's ?hash is derived from the
 * source file, not the rule content, so it never changes when a title or author list
 * does - an immutable year would leave the proxy and every scraper holding a stale
 * card that the webhook's revalidatePath cannot reach.
 */
const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export async function ogImageResponse(element: React.ReactElement) {
  return new ImageResponse(element, {
    ...OG_SIZE,
    fonts: await loadFonts(),
    headers: { "cache-control": CACHE_CONTROL },
  });
}
