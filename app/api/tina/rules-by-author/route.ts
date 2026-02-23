import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authorTitle = searchParams.get("authorTitle");
    const lastStr = searchParams.get("last") ?? searchParams.get("first");
    const before = searchParams.get("before") || undefined;

    if (!authorTitle) {
      return NextResponse.json({ error: "authorTitle is required" }, { status: 400 });
    }

    const last = lastStr ? Number(lastStr) : undefined;

    const result = await client.queries.rulesByAuthor({
      authorTitle,
      last,
      before,
      sort: "created",
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching rules by author from Tina:", error);
    return NextResponse.json({ error: "Failed to fetch rules", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
