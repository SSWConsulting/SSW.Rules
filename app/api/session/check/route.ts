import { auth0 } from "@/lib/auth0";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (session) {
      return NextResponse.json({ isAuthenticated: true }, { status: 200 });
    }
    return NextResponse.json({ authenticated: false }, { status: 200 });
  } catch (error) {
    console.error('Authentication check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
