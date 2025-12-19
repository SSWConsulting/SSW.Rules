import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uris } = body;

    if (!uris || !Array.isArray(uris) || uris.length === 0) {
      return NextResponse.json({ error: "uris array is required" }, { status: 400 });
    }

    const result = await client.queries.rulesByUriQuery({ uris });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching rules by URI from Tina:", error);
    return NextResponse.json({ error: "Failed to fetch rules", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
