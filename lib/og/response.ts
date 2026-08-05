import { ImageResponse } from "next/og";
import { buildOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { loadFonts } from "@/lib/og/images";
import { tagline } from "@/site-config";

// Matches what ImageResponse sets by default, since returning a plain Response below
// means its headers no longer apply. Deliberately not a long s-maxage: the Tina webhook
// can purge Next's cache but not the CDN's, so anything cached at the edge outlives it.
const CACHE_CONTROL = "public, max-age=0, must-revalidate";

/**
 * Renders a card, falling back to the generic one if Satori fails.
 *
 * The buffering is load-bearing. `new ImageResponse(...)` returns a 200 immediately and
 * renders while the body streams, so a try/catch around the constructor alone catches
 * nothing - awaiting the buffer is what surfaces a render failure. Satori also fetches
 * emoji glyphs from a CDN mid-render with no timeout of its own, and rule titles carry
 * emoji often enough for that to matter.
 */
export async function ogImageResponse(element: React.ReactElement, fallbackTitle?: string) {
  const render = async (el: React.ReactElement) => {
    const res = new ImageResponse(el, { ...OG_SIZE, fonts: await loadFonts() });
    return Buffer.from(await res.arrayBuffer());
  };

  let png: Buffer;
  try {
    png = await render(element);
  } catch (error) {
    console.error("[og] render failed, falling back to the generic card:", error);
    png = await render(await buildOgCard({ title: fallbackTitle ?? tagline, isHub: true }));
  }

  return new Response(new Uint8Array(png), {
    headers: { "content-type": OG_CONTENT_TYPE, "cache-control": CACHE_CONTROL },
  });
}
