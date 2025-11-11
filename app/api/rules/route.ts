import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import client from "@/tina/__generated__/client";
import { getBranch, getFetchOptions } from "@/utils/tina/get-branch";

// Helper function to fetch rules data (will be wrapped with cache)
async function fetchRulesData(branch?: string) {
  const PAGE_SIZE = 1000; // server-side page size
  let after: string | undefined = undefined;
  let hasNextPage = true;
  const allEdges: any[] = [];

  // Prepare fetch options with branch header if available
  const fetchOptions = await getFetchOptions();

  // Loop over all pages until exhausted
  for (let i = 0; hasNextPage; i++) {
    const res: any = fetchOptions
      ? await (client as any).queries.paginatedRulesQuery(
          {
            first: PAGE_SIZE,
            after,
          },
          fetchOptions
        )
      : await (client as any).queries.paginatedRulesQuery({
          first: PAGE_SIZE,
          after,
        });
    const data = (res?.data ?? res) as any;
    const conn = data?.ruleConnection;
    const edges = Array.isArray(conn?.edges) ? conn.edges : [];
    allEdges.push(...edges);

    hasNextPage = !!conn?.pageInfo?.hasNextPage;
    const nextCursor = conn?.pageInfo?.endCursor ?? undefined;
    if (!hasNextPage || !nextCursor || edges.length === 0) {
      hasNextPage = false;
      break;
    }
    after = nextCursor;
  }

  const items = allEdges
    .map((e: any) => e?.node)
    .filter(Boolean)
    .map((node: any) => ({
      title: node?.title || "",
      uri: node?.uri || "",
      lastUpdated: node.lastUpdated || "",
      _sys: { relativePath: node?._sys?.relativePath || "" },
    }));

  return items;
}

export async function GET() {
  try {
    const branch = await getBranch();

    // Create a cached function that fetches rules data
    // Cache key includes branch to ensure different branches get different cache entries
    const getCachedRules = unstable_cache(
      fetchRulesData,
      [`rules-${branch || "main"}`], // Cache key includes branch
      {
        revalidate: 300, // Revalidate every 1 hour (3600 seconds)
        tags: ["rules", branch ? `branch-${branch}` : "branch-main"],
      }
    );

    const items = await getCachedRules(branch);

    return new NextResponse(JSON.stringify(items), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[/api/rules] error:", err);
    return NextResponse.json({ message: "Failed to fetch rules" }, { status: 500 });
  }
}
