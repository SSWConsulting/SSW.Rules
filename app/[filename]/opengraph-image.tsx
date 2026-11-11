import { buildOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { ogImageResponse } from "@/lib/og/response";
import { resolveOgTarget } from "@/lib/og/target";
import { fetchRuleCount } from "@/lib/services/rules";
import { tagline } from "@/site-config";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

// Must be a literal - Next statically extracts segment config from the AST and fails
// the build on an expression it cannot evaluate.
export const revalidate = 86400; // 24 hours

export default async function OpengraphImage({ params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const [target, totalRules] = await Promise.all([resolveOgTarget(filename), fetchRuleCount()]);

  return ogImageResponse(
    await buildOgCard({
      title: target.kind === "generic" ? tagline : target.title,
      authors: target.kind === "rule" ? target.authors : [],
      totalRules,
      isHub: target.kind !== "rule",
    })
  );
}
