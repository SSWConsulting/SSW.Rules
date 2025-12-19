import { fetchPaginatedRules } from "@/lib/services/rules";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const firstStr = searchParams.get("first");
  const lastStr = searchParams.get("last");
  const after = searchParams.get("after") || undefined;
  const before = searchParams.get("before") || undefined;

  const first = firstStr ? Number(firstStr) : undefined;
  const last = lastStr ? Number(lastStr) : undefined;
  
  const q = (searchParams.get("q") || "").trim() || undefined;
  const field = (searchParams.get("field") as "title" | "uri") || undefined;
  const sort = searchParams.get("sort") || undefined;

  try {
    const result = await fetchPaginatedRules({ first, last, after, before, q, field, sort });
    return NextResponse.json(
      { items: result.items, pageInfo: result.pageInfo, totalCount: result.totalCount },
      { status: 200 }
    );
  } catch (err) {
    console.error("[/api/rules/paginated] error:", err);
    return NextResponse.json({ message: "Failed to fetch paginated rules" }, { status: 500 });
  }
}
