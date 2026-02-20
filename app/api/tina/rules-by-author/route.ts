import fs from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import client from "@/tina/__generated__/client";

export const runtime = "nodejs";

const AUTHOR_INDEX_FILENAME = "author-title-to-rules-map.json";

type AuthorIndex = Record<string, string[]>;

let cachedIndex: AuthorIndex | null | undefined;

const getAuthorIndex = (): AuthorIndex | null => {
  if (cachedIndex !== undefined) return cachedIndex;

  const indexPath = join(process.cwd(), "public", AUTHOR_INDEX_FILENAME);
  try {
    const raw = fs.readFileSync(indexPath, "utf8");
    cachedIndex = JSON.parse(raw) as AuthorIndex;
  } catch {
    cachedIndex = null;
  }

  return cachedIndex;
};

const encodeCursor = (index: number) => Buffer.from(String(index), "utf8").toString("base64");

const decodeCursor = (cursor: string) => {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const n = Number(decoded);
    return Number.isFinite(n) ? n : -1;
  } catch {
    return -1;
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authorTitle = searchParams.get("authorTitle");
    const firstStr = searchParams.get("first");
    const after = searchParams.get("after") || undefined;

    if (!authorTitle) {
      return NextResponse.json({ error: "authorTitle is required" }, { status: 400 });
    }

    const first = firstStr ? Number(firstStr) : 50;

    const index = getAuthorIndex();
    console.log("??", index)
    if (!index) {
      // Backward-compatible fallback (slow path) if index isn't present in the build.
      const result = await client.queries.rulesByAuthor({ authorTitle, first, after });
      return NextResponse.json(result, { status: 200 });
    }

    const authorFiles = index[authorTitle] ?? [];

    const afterIndex = after ? decodeCursor(after) : -1;
    if (after && afterIndex === -1) {
      // Cursor from the old Tina-backed implementation.
      const result = await client.queries.rulesByAuthor({ authorTitle, first, after });
      return NextResponse.json(result, { status: 200 });
    }

    const start = Math.max(0, afterIndex + 1);
    const size = Number.isFinite(first) && first > 0 ? first : 50;

    const endExclusive = Math.min(start + size, authorFiles.length);
    const pageFiles = authorFiles.slice(start, endExclusive);

    const nodes = await Promise.all(
      pageFiles.map(async (relativePath) => {
        try {
          const res = await client.queries.ruleDataBasic({ relativePath });
          const rule: any = res?.data?.rule;
          if (!rule || typeof rule.guid !== "string") return null;

          return {
            guid: rule.guid,
            title: rule.title,
            uri: rule.uri,
            body: rule.body,
            authors: (rule.authors ?? [])
              .map((a: any) => (a && a.title ? { title: a.title } : null))
              .filter((a: any) => a !== null),
            lastUpdated: rule.lastUpdated,
            lastUpdatedBy: rule.lastUpdatedBy,
          };
        } catch {
          return null;
        }
      })
    );

    const edges = nodes.filter(Boolean).map((node) => ({ node }));

    const hasNextPage = endExclusive < authorFiles.length;
    const endCursor = edges.length > 0 ? encodeCursor(endExclusive - 1) : null;

    return NextResponse.json(
      {
        data: {
          ruleConnection: {
            pageInfo: {
              hasNextPage,
              endCursor,
            },
            edges,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching rules by author:", error);
    return NextResponse.json({ error: "Failed to fetch rules", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
