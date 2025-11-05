import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

enum TINA_CONTENT_CHANGE_TYPE {
  Modified = "content.modified",
  Added = "content.added",
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-revalidate-secret");
    if (secret !== process.env.TINA_WEBHOOK_SECRET) {
      return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const eventType = body?.type;
    if (eventType !== TINA_CONTENT_CHANGE_TYPE.Modified && eventType !== TINA_CONTENT_CHANGE_TYPE.Added) {
      return NextResponse.json({ revalidated: false, ignored: true, reason: `Unhandled type: ${eventType}` }, { status: 200 });
    }

    const changedPaths: string[] = Array.isArray(body?.paths) ? body.paths : [];
    if (changedPaths.length === 0) {
      return NextResponse.json({ revalidated: false, reason: "No paths in payload" }, { status: 200 });
    }

    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/^\/+/, "");
    const pathsToRevalidate = [`/${basePath}/api/rules`];
    const routesToRevalidate = new Set<string>();

    for (const changedPath of changedPaths) {
      if (typeof changedPath !== "string") continue;

      // Example: public/uploads/rules/3-steps-to-a-pbi/rule.mdx => /3-steps-to-a-pbi
      if (changedPath.startsWith("public/uploads/rules/")) {
        const slug = changedPath.replace("public/uploads/rules/", "").replace("/rule.mdx", "").replace(/\/+$/, "");
        if (slug) {
          routesToRevalidate.add(`/${basePath}/${slug}`);
        }
      }
    }

    if (eventType === TINA_CONTENT_CHANGE_TYPE.Added) {
      for (const route of pathsToRevalidate) {
        routesToRevalidate.add(route);
      }
    }

    for (const route of routesToRevalidate) {
      revalidatePath(route, "page");
    }

    return NextResponse.json({ revalidated: true, routes: Array.from(routesToRevalidate) });
  } catch (err) {
    console.error("Error during revalidation", err);
    return NextResponse.json({ message: "Error revalidating" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Method Not Allowed" }, { status: 405 });
}
