import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";
import { getBranch, getFetchOptions } from "@/utils/tina/get-branch";

// Helper function to fetch category data (will be wrapped with cache)
async function fetchCategoryData(relativePath: string, branch?: string) {
  if (branch) {
    return await client.queries.categoryWithRulesQuery({ relativePath }, await getFetchOptions());
  } else {
    return await client.queries.categoryWithRulesQuery({ relativePath });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get("relativePath");

    if (!relativePath) {
      return NextResponse.json({ error: "relativePath is required" }, { status: 400 });
    }

    const branch = await getBranch();

    // Create a cached function that fetches category data
    // Cache key includes both relativePath and branch to ensure different branches get different cache entries
    const getCachedCategory = unstable_cache(
      fetchCategoryData,
      [`category-${relativePath}-${branch || "main"}`], // Cache key includes branch
      {
        revalidate: 3600, // Revalidate every 1 hour (3600 seconds)
        tags: [`category-${relativePath}`, branch ? `branch-${branch}` : "branch-main"],
      }
    );

    const result = await getCachedCategory(relativePath, branch);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching category from Tina:", error);
    return NextResponse.json({ error: "Failed to fetch category", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
