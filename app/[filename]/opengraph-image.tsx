import { buildOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { ogImageResponse } from "@/lib/og/response";
import { resolveOgTarget } from "@/lib/og/target";
import { fetchRuleCount } from "@/lib/services/rules";
import { tagline } from "@/site-config";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

export const revalidate = 60 * 60 * 24;

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
