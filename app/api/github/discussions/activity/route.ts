import { NextResponse } from "next/server";
import { getCachedActivityRules } from "@/lib/services/github/discussions.service";

const SIX_HOURS = 6 * 60 * 60;

export async function GET() {
  try {
    const rules = await getCachedActivityRules();
    return NextResponse.json(
      { rules, total: rules.length },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${SIX_HOURS}, stale-while-revalidate=60`,
        },
      }
    );
  } catch (error) {
    console.error("[/api/github/discussions/activity] error:", error);
    return NextResponse.json({ error: "Failed to fetch discussion activity" }, { status: 500 });
  }
}
