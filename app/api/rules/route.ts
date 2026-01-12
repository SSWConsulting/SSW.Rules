import { NextResponse } from "next/server";
import client from "@/tina/__generated__/client";
import * as appInsights from "applicationinsights";

export const revalidate = 3600; // 1 hour
// Helper function to fetch rules data (will be wrapped with cache)
async function fetchRulesData() {
  const PAGE_SIZE = 1000; // server-side page size
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
      lastUpdated: node.lastUpdated || "",
      _sys: { relativePath: node?._sys?.relativePath || "" },
    }));

  return items;
}

export async function GET() {
  const startTime = Date.now();

  try {
    const data = await fetchRulesData();
    const duration = Date.now() - startTime;

    // Track successful rules fetch
    appInsights.defaultClient?.trackEvent({
      name: "RulesApiFetchSuccess",
      properties: {
        ruleCount: data.length,
        duration
      }
    });

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[/api/rules] error:", err);

    // Track rules fetch error
    appInsights.defaultClient?.trackException({
      exception: err instanceof Error ? err : new Error(String(err)),
      properties: {
        endpoint: "/api/rules",
        duration: Date.now() - startTime
      }
    });

    return NextResponse.json({ message: "Failed to fetch rules" }, { status: 500 });
  }
}
