import { buildOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { ogImageResponse } from "@/lib/og/response";
import { fetchRuleCount } from "@/lib/services/rules";
import { tagline } from "@/site-config";

/**
 * The generic card, shared by every segment that does not build its own.
 *
 * Next's metadata image files apply to the segment they sit in and are NOT inherited
 * by nested segments, so a single app/opengraph-image.tsx covers only the root - every
 * other route needs its own file re-exporting this one. Verified on a deployed slot:
 * with only the root file, every page except rules and categories emitted no og:image.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

export default async function siteOgImage() {
  return ogImageResponse(await buildOgCard({ title: tagline, totalRules: await fetchRuleCount(), isHub: true }));
}
