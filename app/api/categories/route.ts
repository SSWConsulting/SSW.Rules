import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

// Helper function to fetch main category data (will be wrapped with cache)
async function fetchMainCategoryData(branch?: string) {
  if (branch) {
    return await client.queries.mainCategoryQuery(
      {},
      {
        fetchOptions: {
          headers: {
            "x-branch": branch,
          },
        },
      }
    );
  } else {
    return await client.queries.mainCategoryQuery({});
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const branch = cookieStore.get("x-branch")?.value || undefined;

    // Create a cached function that fetches main category data
    // Cache key includes branch to ensure different branches get different cache entries
    const getCachedMainCategory = unstable_cache(
      fetchMainCategoryData,
      [`main-category-${branch || "main"}`], // Cache key includes branch
      {
        revalidate: 3600, // Revalidate every 1 hour (3600 seconds)
        tags: ["main-category", branch ? `branch-${branch}` : "branch-main"],
      }
    );

    const result = await getCachedMainCategory(branch);

    if (!result?.data?.category || result.data.category.__typename !== "CategoryMain") {
      return NextResponse.json({ categories: [] }, { status: 200 });
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

    return NextResponse.json({ categories: items }, { status: 200 });
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
