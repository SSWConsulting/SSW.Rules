import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

// Helper function to fetch top categories data (will be wrapped with cache)
async function fetchTopCategoriesData(first: number, after: string | null, branch?: string) {
  if (branch) {
    return await client.queries.topCategoryWithIndexQuery(
      { first, after },
      {
        fetchOptions: {
          headers: {
            "x-branch": branch,
          },
        },
      }
    );
  } else {
    return await client.queries.topCategoryWithIndexQuery({ first, after });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const first = parseInt(searchParams.get("first") || "50", 10);
    const after = searchParams.get("after") || null;

    const cookieStore = await cookies();
    const branch = cookieStore.get("x-branch")?.value || undefined;

    // Create a cached function that fetches top categories data
    // Cache key includes first, after, and branch to ensure different queries get different cache entries
    const getCachedTopCategories = unstable_cache(
      fetchTopCategoriesData,
      [`top-categories-${first}-${after || "null"}-${branch || "main"}`], // Cache key includes branch and pagination
      {
        revalidate: 43200, // Revalidate every 12 hours (43200 seconds)
        tags: ["top-categories", branch ? `branch-${branch}` : "branch-main"],
      }
    );

    const result = await getCachedTopCategories(first, after, branch);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching top categories from Tina:", error);
    return NextResponse.json({ error: "Failed to fetch top categories", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
