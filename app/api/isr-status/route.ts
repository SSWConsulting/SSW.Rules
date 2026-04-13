import { NextResponse } from "next/server";
import { getSlugStatus } from "@/lib/revalidation-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "slug parameter is required" }, { status: 400 });
  }

  const status = getSlugStatus(slug);

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
