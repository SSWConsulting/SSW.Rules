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

      // Extract all broken paths from error message (there may be multiple)
      const brokenPathMatches = errorMessage.matchAll(/Unable to find record ([^\n]+)/g);
      const brokenPaths = Array.from(brokenPathMatches, (match) => match[1].trim());

      // Fallback if no paths found
      if (brokenPaths.length === 0) {
        brokenPaths.push("unknown path");
      }

      console.warn(`Broken related rule references detected: ${brokenPaths.join(", ")}`);

      // Return basic result with metadata about the broken references
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
            paths: brokenPaths,
            message: `This rule has broken related rule references. Please edit the rule to fix this.`,
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
