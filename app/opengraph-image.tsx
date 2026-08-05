import { buildOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { ogImageResponse } from "@/lib/og/response";
import { fetchRuleCount } from "@/lib/services/rules";
import { tagline } from "@/site-config";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

export const revalidate = 60 * 60 * 24;

// Default card for every page without one of its own - home, search, latest-rules,
// archived, user, orphaned. Inherited automatically by Next's metadata resolution.
export default async function OpengraphImage() {
  return ogImageResponse(await buildOgCard({ title: tagline, totalRules: await fetchRuleCount(), isHub: true }));
}
