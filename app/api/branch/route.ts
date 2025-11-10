import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const branch = cookieStore.get("x-branch")?.value ?? "";
    return NextResponse.json({ branch }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ branch: "" }, { status: 200 });
  }
}


