import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Support both new 'authorSlug' and legacy 'authorTitle' parameters
    const authorSlug = searchParams.get("authorSlug") || searchParams.get("authorTitle");
    const firstStr = searchParams.get("first");
    const after = searchParams.get("after") || undefined;

    if (!authorSlug) {
      return NextResponse.json({ error: "authorSlug is required" }, { status: 400 });
    }

    const first = firstStr ? Number(firstStr) : undefined;

    const result = await client.queries.rulesByAuthor({
      authorSlug,
      first,
      after,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching rules by author from Tina:", error);
    return NextResponse.json({ error: "Failed to fetch rules", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
