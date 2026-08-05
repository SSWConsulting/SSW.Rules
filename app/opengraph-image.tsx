import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/components/og/card";
import { fetchRuleCount } from "@/lib/services/rules";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

/**
 * Shorter than `homepageTitle` in site-config, which carries an SEO suffix
 * ("... (Open Source on GitHub)") that reads as clutter on a social card.
 * The page <title> still uses the full version.
 */
const OG_TITLE = "Secret Ingredients to Quality Software";

// Default card for every page without one of its own - home, search, latest-rules,
// archived, user, orphaned. Inherited automatically by Next's metadata resolution.
export default async function OpengraphImage() {
  let totalRules: number | undefined;
  try {
    totalRules = await fetchRuleCount();
  } catch {
    // The card still renders without the total; better than failing the image
  }

  return new ImageResponse(await OgCard({ title: OG_TITLE, totalRules, isHub: true }), size);
}
