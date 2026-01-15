import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tag = body?.tag;

    if (!tag || typeof tag !== "string") {
      return NextResponse.json(
        { 
          success: false, 
          error: "Tag is required and must be a string",
          tag: tag || null 
        }, 
        { status: 400 }
      );
    }

    revalidateTag(tag);

    return NextResponse.json({ 
      success: true, 
      tag 
    }, { status: 200 });
  } catch (err) {
    console.error("Error during tag revalidation", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { 
        success: false, 
        error: "Error revalidating tag",
        details: errorMessage 
      }, 
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tag = searchParams.get("tag");

    if (!tag) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Tag query parameter is required",
          tag: null 
        }, 
        { status: 400 }
      );
    }

    revalidateTag(tag);

    return NextResponse.json({ 
      success: true, 
      tag 
    }, { status: 200 });
  } catch (err) {
    console.error("Error during tag revalidation", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { 
        success: false, 
        error: "Error revalidating tag",
        details: errorMessage 
      }, 
      { status: 500 }
    );
  }
}
