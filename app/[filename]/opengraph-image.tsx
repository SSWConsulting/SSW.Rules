import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { buildOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { resolveOgTarget } from "@/lib/og/target";
import { fetchRuleCount } from "@/lib/services/rules";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

export const revalidate = 60 * 60 * 24;

export default async function OpengraphImage({ params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  const [target, totalRules] = await Promise.all([resolveOgTarget(filename), fetchRuleCount()]);

  // Without this, any junk path renders a card - an unbounded cache key and Satori render
  if (target.kind === "unknown") notFound();

  return new ImageResponse(
    await buildOgCard({
      title: target.title,
      authors: target.kind === "rule" ? target.authors : [],
      totalRules,
      isHub: target.kind === "category",
    }),
    size
  );
}
