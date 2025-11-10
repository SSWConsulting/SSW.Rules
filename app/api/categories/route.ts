import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const branch = cookieStore.get("x-branch")?.value || undefined;

    // Fetch categories using the Tina client (works in both dev and production)
    let result;
    if (branch) {
      result = await client.queries.mainCategoryQuery(
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
      result = await client.queries.mainCategoryQuery({});
    }

    if (!result?.data?.category || result.data.category.__typename !== "CategoryMain") {
      return NextResponse.json(
        { categories: [] },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400", // 12 hours cache, 24 hours stale-while-revalidate
          },
        }
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
      { categories: items },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400", // 12 hours cache, 24 hours stale-while-revalidate
        },
      }
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
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store", // Don't cache errors
        },
      }
    );
  }
}
