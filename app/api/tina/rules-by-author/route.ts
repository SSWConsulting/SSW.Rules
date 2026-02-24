import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

const FIRST_BATCH_SIZE = 20;
const FIRST_BATCH_CACHE_SECONDS = 60 * 60 * 24;
const FIRST_BATCH_STALE_WHILE_REVALIDATE_SECONDS = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authorTitle = searchParams.get("authorTitle");
    const lastStr = searchParams.get("last") ?? searchParams.get("first");
    const before = searchParams.get("before") || undefined;

    if (!authorTitle) {
      return NextResponse.json({ error: "authorTitle is required" }, { status: 400 });
    }

    const last = lastStr ? Number(lastStr) : undefined;
    const isFirstBatch = before === undefined && (last === undefined || last === FIRST_BATCH_SIZE);
    const isDev = process.env.NODE_ENV === "development";

    const fetchRulesByAuthor = (a: string, l?: number, b?: string) =>
      client.queries.rulesByAuthor({
        authorTitle: a,
        last: l,
        before: b,
        sort: "created",
      });

    const result = isFirstBatch && !isDev
      ? await unstable_cache(
          async (a: string) => fetchRulesByAuthor(a, FIRST_BATCH_SIZE, undefined),
          [`tina-rules-by-author-first-batch-${authorTitle}-${FIRST_BATCH_SIZE}`],
          { revalidate: FIRST_BATCH_CACHE_SECONDS }
        )(authorTitle)
      : await fetchRulesByAuthor(authorTitle, last, before);

    const res = NextResponse.json(result, { status: 200 });

    if (isFirstBatch && !isDev) {
      res.headers.set(
        "Cache-Control",
        `public, s-maxage=${FIRST_BATCH_CACHE_SECONDS}, stale-while-revalidate=${FIRST_BATCH_STALE_WHILE_REVALIDATE_SECONDS}`
      );
    } else if (isDev) {
      res.headers.set("Cache-Control", "no-store");
    }

    return res;
  } catch (error) {
    console.error("Error fetching rules by author from Tina:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
