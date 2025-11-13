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

    const routesToRevalidate = new Set<string>();
    for (const changedPath of changedPaths) {
      if (typeof changedPath !== "string") continue;

      // Example: public/uploads/rules/3-steps-to-a-pbi/rule.mdx => /3-steps-to-a-pbi
      if (changedPath.startsWith("public/uploads/rules/")) {
        const slug = changedPath.replace("public/uploads/rules/", "").replace("/rule.mdx", "").replace(/\/+$/, "");
        if (slug) {
          routesToRevalidate.add(`/${slug}`);
        }
        // If change type is add then we also need to revalidate the /api/rules route
        if (eventType === TINA_CONTENT_CHANGE_TYPE.Added) {
          routesToRevalidate.add("/api/rules");
        }
      }

      // Example: categories/communication/rules-to-better-email.mdx -> /rules-to-better-email
      if (changedPath.startsWith("categories/")) {
        const rel = changedPath.replace("categories/", "");
        // Ignore main/top index files like categories/index.mdx or categories/<top>/index.mdx
        if (!rel.endsWith("/index.mdx") && rel.endsWith(".mdx")) {
          const filename = rel.replace(/\.mdx$/, "").split("/").pop();
          if (filename) {
            routesToRevalidate.add(`/${filename}`);
          }
        }
        // If change type is add then we also need to revalidate the /api/categories route
        if (eventType === TINA_CONTENT_CHANGE_TYPE.Added) {
          routesToRevalidate.add("/api/categories");
        }
      }
    }

    for (const route of routesToRevalidate) {
      revalidatePath(route);
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
