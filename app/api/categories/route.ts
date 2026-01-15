import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import client from "@/tina/__generated__/client";
import { getFetchOptions } from "@/utils/tina/get-branch";

// Store cache metadata to track freshness
const cacheMetadata = new Map<string, { lastFetchTime: number }>();

// Helper function to fetch main category data (will be wrapped with cache)
async function fetchMainCategoryData(branch?: string) {
  const cacheKey = `main-category-${branch || "main"}`;
  console.log("[fetchMainCategoryData] Called with branch:", branch, "cacheKey:", cacheKey);

  // Mark that we're fetching fresh data (cache miss)
  cacheMetadata.set(cacheKey, { lastFetchTime: Date.now() });

  if (branch) {
    const fetchOptions = await getFetchOptions();
    console.log("[fetchMainCategoryData] Branch provided, using fetchOptions:", JSON.stringify(fetchOptions));
    return await client.queries.mainCategoryQuery({}, fetchOptions);
  } else {
    console.log("[fetchMainCategoryData] No branch provided, using default query (main branch)");
    return await client.queries.mainCategoryQuery({});
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const branch = cookieStore.get("x-branch")?.value || undefined;
    const branchName = branch || "main";
    const cacheKey = `main-category-${branchName}`;
    
    console.log("[GET /api/categories] Cookie x-branch value:", cookieStore.get("x-branch")?.value);
    console.log("[GET /api/categories] Extracted branch:", branch);
    console.log("[GET /api/categories] Branch name:", branchName);
    console.log("[GET /api/categories] Cache key:", cacheKey);

    // Create a cached function that fetches main category data
    // Cache key includes branch to ensure different branches get different cache entries
    const getCachedMainCategory = unstable_cache(
      fetchMainCategoryData,
      [cacheKey], // Cache key includes branch
      {
        revalidate: 84600, // Revalidate every 12 hours (84600 seconds)
        tags: ["main-category-categories", `branch-${branchName}-categories`],
      }
    );

    // Check if we have cached metadata before calling
    const existingMetadata = cacheMetadata.get(cacheKey);
    const beforeFetchTime = Date.now();

    console.log("[GET /api/categories] Calling getCachedMainCategory with branch:", branch);
    const result = await getCachedMainCategory(branch);
    console.log("[GET /api/categories] Result received, has data:", !!result?.data);

    // Check if metadata was updated (meaning fresh fetch happened)
    const afterMetadata = cacheMetadata.get(cacheKey);
    const isFresh = afterMetadata && afterMetadata.lastFetchTime >= beforeFetchTime - 100; // Small buffer for timing

    // If data is fresh, it's not cached. Otherwise, check if it's within cache window
    const isCached = !isFresh && existingMetadata && existingMetadata.lastFetchTime && beforeFetchTime - existingMetadata.lastFetchTime < 3600000;

    if (!result?.data?.category || result.data.category.__typename !== "CategoryMain") {
      return NextResponse.json(
        {
          categories: [],
          cached: isCached,
          fresh: isFresh,
          ...(branch && { branch }),
        },
        { status: 200 }
      );
    }

    // Transform the data to match what CategorySelector expects
    const categories = result.data.category.index || [];
    const items = categories.flatMap((top: any) => {
      const subcats: any[] = top?.top_category?.index?.map((s: any) => s?.category).filter(Boolean) || [];
      return subcats.map((sub: any) => ({
        title: `${top?.top_category?.title || ""} | ${sub?.title?.replace("Rules to Better", "") || ""}`,
        _sys: { relativePath: `${top?.top_category?.uri}/${sub?._sys?.filename}.mdx` },
      }));
    });

    return NextResponse.json(
      {
        categories: items,
        cached: isCached,
        fresh: isFresh,
        ...(branch && { branch }),
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Failed to fetch categories:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    return NextResponse.json(
      {
        categories: [],
        error: "Failed to fetch categories",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
