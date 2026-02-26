import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";
import { CategoryWithRulesQueryDocument } from "@/tina/__generated__/types";
import { getBranch, getFetchOptions } from "@/utils/tina/get-branch";

// Helper function to fetch category data (will be wrapped with cache)
async function fetchCategoryData(relativePath: string, branch?: string) {
  const options = branch ? await getFetchOptions(branch) : undefined;

  const res: any = await (client as any).request(
    {
      query: CategoryWithRulesQueryDocument,
      variables: { relativePath },
      errorPolicy: "all",
    },
    options
  );

  const errorMessages = (res?.errors ?? [])
    .map((e: any) => (typeof e === "string" ? e : e?.message))
    .filter((m: any): m is string => typeof m === "string" && m.length > 0);

  const missingRecordErrors = errorMessages.filter((m) => m.includes("Unable to find record"));
  if (missingRecordErrors.length > 0) {
    console.warn(`[api/tina/category] Missing rule references in category relativePath="${relativePath}":\n${missingRecordErrors.join("\n")}`);
  }

  return {
    data: res?.data,
    errors: res?.errors ?? null,
    query: CategoryWithRulesQueryDocument,
    variables: { relativePath },
  };
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
    console.error(`[api/tina/category] failed for relativePath="${relativePath}":`, error);
    return NextResponse.json({ error: "Failed to fetch category", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
