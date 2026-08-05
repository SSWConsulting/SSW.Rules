import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/components/og/card";
import { homepageTitle } from "@/site-config";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "SSW Rules";

// Default card for every page without one of its own - home, search, latest-rules,
// archived, user, orphaned. Inherited automatically by Next's metadata resolution.
export default async function OpengraphImage() {
  return new ImageResponse(await OgCard({ title: homepageTitle }), size);
}
