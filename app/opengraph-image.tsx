import { ImageResponse } from "next/og";
import { buildOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { fetchRuleCount } from "@/lib/services/rules";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

export const revalidate = 60 * 60 * 24;

// Shorter than site-config's homepageTitle, which carries an SEO suffix
const OG_TITLE = "Secret Ingredients to Quality Software";

// Default card for every page without one of its own - home, search, latest-rules,
// archived, user, orphaned. Inherited automatically by Next's metadata resolution.
export default async function OpengraphImage() {
  return new ImageResponse(await buildOgCard({ title: OG_TITLE, totalRules: await fetchRuleCount(), isHub: true }), size);
}
