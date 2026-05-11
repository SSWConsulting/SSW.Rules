import { NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

// Always fetch fresh data from TinaCMS — never use cached version
export const dynamic = "force-dynamic";

// Only allow paths like: my-rule/rule.mdx or my-rule/rule.md
const VALID_RELATIVE_PATH = /^[\w-]+\/rule\.(mdx?|md)$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const relativePath = searchParams.get("relativePath");

  if (!relativePath || !VALID_RELATIVE_PATH.test(relativePath)) {
    return NextResponse.json({ error: "Invalid or missing relativePath" }, { status: 400 });
  }

  try {
    const res = await client.queries.ruleDataBasic({ relativePath });
    const lastUpdated = res?.data?.rule?.lastUpdated ?? null;
    return NextResponse.json({ lastUpdated });
  } catch {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
}
