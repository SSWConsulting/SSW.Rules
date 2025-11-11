import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";
import { getFetchOptions } from "@/utils/tina/get-branch";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get("relativePath");

    if (!relativePath) {
      return NextResponse.json({ error: "relativePath is required" }, { status: 400 });
    }
    const fetchOptions = await getFetchOptions();
    // Fetch rule using the Tina client with branch support
    let result;
    if (fetchOptions) {
      result = await client.queries.ruleData({ relativePath }, fetchOptions);
    } else {
      result = await client.queries.ruleData({ relativePath });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching rule from Tina:", error);
    return NextResponse.json({ error: "Failed to fetch rule", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
