import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Serve public/llms.txt as text/plain.
 *
 * Next.js standalone mode does not always serve files from public/ automatically,
 * so this Route Handler guarantees the file is accessible at /rules/llms.txt.
 */
export async function GET() {
  const filePath = join(process.cwd(), "public", "llms.txt");

  try {
    const content = readFileSync(filePath, "utf-8");

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[llms.txt] Failed to read ${filePath}: ${message}`);
    return new Response("llms.txt not found", { status: 404 });
  }
}
