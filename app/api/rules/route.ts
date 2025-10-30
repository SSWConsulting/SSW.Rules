import { NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const searchQuery = searchParams.get("search")?.trim().toLowerCase();

    // If no pagination params, return empty response (require search)
    if (!pageParam || !limitParam) {
      return NextResponse.json(
        { rules: [], hasMore: false, total: 0 },
        { status: 200 }
      );
    }

    const page = parseInt(pageParam, 10);
    const limit = parseInt(limitParam, 10);

    // Fetch rules from Tina with a reasonable page size
    const TINA_PAGE_SIZE = 100;
    let after: string | undefined = undefined;
    let hasNextPage = true;
    const allEdges: any[] = [];

    // Fetch multiple pages if needed to gather enough data
    while (hasNextPage && allEdges.length < page * limit + limit) {
      const res: any = await (client as any).queries.paginatedRulesQuery({
        first: TINA_PAGE_SIZE,
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

    // Process all rules
    let items = allEdges
      .map((e: any) => e?.node)
      .filter(Boolean)
      .map((node: any) => ({
        id: node?.id || node?._sys?.relativePath || "",
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

    // Apply search filter if provided
    if (searchQuery && searchQuery.length >= 2) {
      items = items.filter((item) => {
        const uri = item.uri.toLowerCase();
        const title = item.title.toLowerCase();
        return uri.includes(searchQuery) || title.includes(searchQuery);
      });

      // Prioritize matches that start with the query
      const startsWithMatches = items.filter(
        (item) =>
          item.uri.toLowerCase().startsWith(searchQuery) ||
          item.title.toLowerCase().startsWith(searchQuery)
      );
      const startsWithIds = new Set(startsWithMatches.map((item) => item.id));
      const includesMatches = items.filter(
        (item) => !startsWithIds.has(item.id)
      );
      items = [...startsWithMatches, ...includesMatches];
    }

    const totalCount = items.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRules = items.slice(startIndex, endIndex);
    const hasMore = endIndex < totalCount;

    return NextResponse.json(
      {
        rules: paginatedRules,
        hasMore,
        total: totalCount,
        page,
        limit,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("[/api/rules] error:", err);
    return NextResponse.json(
      { message: "Failed to fetch rules", rules: [], hasMore: false, total: 0 },
      { status: 500 }
    );
  }
}