import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV === "development";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const branch = cookieStore.get("x-branch")?.value ?? "";
    return NextResponse.json({ branch: isDev ? "" : branch }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ branch: "" }, { status: 200 });
  }
}
