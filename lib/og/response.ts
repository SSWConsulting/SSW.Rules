import { ImageResponse } from "next/og";
import { buildOgCard, OG_SIZE } from "@/lib/og/card";
import { loadFonts } from "@/lib/og/images";
import { tagline } from "@/site-config";

/**
 * ImageResponse defaults to `public, immutable, no-transform, max-age=31536000`
 * (next/dist/server/og/image-response.js). The image URL's ?hash is derived from the
 * source file, not the rule content, so it never changes when a title or author list
 * does - an immutable year would leave the proxy and every scraper holding a stale
 * card that the webhook's revalidatePath cannot reach.
 */
const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export async function ogImageResponse(element: React.ReactElement, fallbackTitle?: string) {
  const render = async (el: React.ReactElement) => new ImageResponse(el, { ...OG_SIZE, fonts: await loadFonts(), headers: { "cache-control": CACHE_CONTROL } });

  try {
    return await render(element);
  } catch (error) {
    // Satori fetches emoji glyphs from a CDN mid-render with no timeout of its own, so
    // a blip there would otherwise 500 the route. A plain card beats no card.
    console.error("[og] render failed, falling back to the generic card:", error);
    return render(await buildOgCard({ title: fallbackTitle ?? tagline, isHub: true }));
  }
}
