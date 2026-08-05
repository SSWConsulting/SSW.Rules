import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/components/og/card";
import { fetchRuleCount } from "@/lib/services/rules";
import { homepageTitle } from "@/site-config";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

// Default card for every page without one of its own - home, search, latest-rules,
// archived, user, orphaned. Inherited automatically by Next's metadata resolution.
export default async function OpengraphImage() {
  let totalRules: number | undefined;
  try {
    totalRules = await fetchRuleCount();
  } catch {
    // The card still renders without the total; better than failing the image
  }

  return new ImageResponse(await OgCard({ title: homepageTitle, totalRules, isHub: true }), size);
}
