import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

export async function POST(request: NextRequest) {
  try {
    const { guids } = await request.json();

    if (!Array.isArray(guids) || guids.length === 0) {
      return NextResponse.json({ message: "guids must be a non-empty array" }, { status: 400 });
    }

    const res = await client.queries.rulesByGuidQuery({ guids });
    const edges = res?.data?.ruleConnection?.edges ?? [];

    const rules = edges
      .map((e: any) => e?.node)
      .filter(Boolean)
      .map((node: any) => ({
        guid: node.guid,
        title: node.title,
        uri: node.uri,
        body: node.body,
        authors: Array.isArray(node.authors) ? node.authors.map((a: any) => a?.author).filter(Boolean) : [],
      }));

    return NextResponse.json({ rules }, { status: 200 });
  } catch (err) {
    console.error("[/api/rules/by-guid] error:", err);
    return NextResponse.json({ message: "Failed to fetch rules by GUID" }, { status: 500 });
  }
}
