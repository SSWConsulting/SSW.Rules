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
  const { searchParams } = new URL(request.url);
  const relativePath = searchParams.get("relativePath");

  try {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRecordNotFound = errorMessage.includes("Unable to find record");

    if (isRecordNotFound) {
      // Extract broken rule paths from error message
      const brokenPathMatches = errorMessage.matchAll(/Unable to find record ([^\n]+)/g);
      const brokenPaths = Array.from(brokenPathMatches, (match) => match[1].trim());

      console.warn(`[api/tina/category] Broken rule references in category "${relativePath}": ${brokenPaths.join(", ")}`);

      // Derive a fallback title from the relativePath (e.g., "design/rules-to-better-ui.mdx" -> "Rules To Better Ui")
      const filename = relativePath.replace(/\.mdx$/, "").split("/").pop() ?? "";
      const fallbackTitle = filename.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      return NextResponse.json(
        {
          data: {
            category: {
              __typename: "CategoryCategory",
              title: fallbackTitle,
              body: null,
              uri: filename,
              index: [],
            },
          },
          query: "",
          variables: { relativePath },
          _brokenReferences: {
            detected: true,
            paths: brokenPaths.length > 0 ? brokenPaths : ["unknown path"],
          },
        },
        { status: 200 }
      );
    }

    console.error(`[api/tina/category] failed for relativePath="${relativePath}":`, error);
    return NextResponse.json({ error: "Failed to fetch category", details: errorMessage }, { status: 500 });
  }
}
