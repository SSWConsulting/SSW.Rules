import { NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

// In-memory cache for aggregated rules (per server instance)
let cachedItems: any[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60000; // 1 minute

export async function GET() {
  try {
    const now = Date.now();
    if (cachedItems && cacheExpiresAt > now) {
      return new NextResponse(JSON.stringify(cachedItems), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "s-maxage=900, stale-while-revalidate=60",
          "X-Cache": "HIT",
        },
      });
    }
    const PAGE_SIZE = 4000; // server-side page size (Tina may cap to 50)
    let after: string | undefined = undefined;
    let hasNextPage = true;
    const allEdges: any[] = [];

    // Loop over all pages until exhausted
    for (let i = 0; hasNextPage; i++) {
      const res: any = await (client as any).queries.paginatedRulesQuery({
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
        created: node?.created || "",
        lastUpdated: node?.lastUpdated || "",
        _sys: { relativePath: node?._sys?.relativePath || "" },
      }))
      .sort((a, b) => {
        // Sort by most recent timestamp (lastUpdated or created if no update)
        const aDate = new Date(a.lastUpdated || a.created || 0).getTime();
        const bDate = new Date(b.lastUpdated || b.created || 0).getTime();
        return bDate - aDate; // Descending order (most recent first)
      });

    // Update cache
    cachedItems = items;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return new NextResponse(JSON.stringify(items), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=900, stale-while-revalidate=60",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("[/api/rules] error:", err);
    return NextResponse.json({ message: "Failed to fetch rules" }, { status: 500 });
  }
}