import { buildOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { ogImageResponse } from "@/lib/og/response";
import { fetchRuleCount } from "@/lib/services/rules";
import { tagline } from "@/site-config";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

// Must be a literal - Next statically extracts segment config from the AST and fails
// the build on an expression it cannot evaluate.
export const revalidate = 86400; // 24 hours

// Default card for every page without one of its own - home, search, latest-rules,
// archived, user, orphaned. Inherited automatically by Next's metadata resolution.
export default async function OpengraphImage() {
  return ogImageResponse(await buildOgCard({ title: tagline, totalRules: await fetchRuleCount(), isHub: true }));
}
