import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { buildOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { loadFonts } from "@/lib/og/images";
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

  // Only a genuine miss 404s. A failed lookup falls through to the generic card below,
  // because page.tsx still serves these paths and a broken og:image is worse than a
  // plain one.
  if (target.kind === "unknown") notFound();

  return new ImageResponse(
    await buildOgCard({
      title: target.kind === "unavailable" ? tagline : target.title,
      authors: target.kind === "rule" ? target.authors : [],
      totalRules,
      isHub: target.kind !== "rule",
    }),
    { ...size, fonts: await loadFonts() }
  );
}
