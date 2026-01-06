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

    // First, try the basic query (without related field resolution)
    // This ensures we always get the rule data even if references are broken
    const basicResult = fetchOptions
      ? await client.queries.ruleDataBasic({ relativePath }, fetchOptions)
      : await client.queries.ruleDataBasic({ relativePath });

    // Now try the full query to get related rules
    try {
      const fullResult = fetchOptions
        ? await client.queries.ruleData({ relativePath }, fetchOptions)
        : await client.queries.ruleData({ relativePath });

      // Full query succeeded - no broken references
      return NextResponse.json(fullResult, { status: 200 });
    } catch (relatedError) {
      // Full query failed but basic succeeded - broken references detected
      const errorMessage = relatedError instanceof Error ? relatedError.message : String(relatedError);
      const brokenPathMatch = errorMessage.match(/Unable to find record ([^\n]+)/);
      const brokenPath = brokenPathMatch ? brokenPathMatch[1].trim() : "unknown path";

      console.warn(`Broken related rule reference detected: ${brokenPath}`);

      // Return basic result with metadata about the broken reference
      return NextResponse.json(
        {
          ...basicResult,
          data: {
            ...basicResult.data,
            rule: {
              ...basicResult.data.rule,
              related: [], // Clear broken related rules
            },
          },
          _brokenReferences: {
            detected: true,
            paths: [brokenPath],
            message: `This rule has a broken related rule reference: ${brokenPath}. Please edit the rule to fix this.`,
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error fetching rule from Tina:", error);
    return NextResponse.json({ error: "Failed to fetch rule", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
