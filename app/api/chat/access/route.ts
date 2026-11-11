import { NextResponse } from "next/server";
import { getAuth0 } from "@/lib/auth0";
import { getRulesChatTier } from "@/lib/rulesChatAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAuth0().getSession();
    return NextResponse.json({ allowed: (await getRulesChatTier(session?.user)) !== null });
  } catch (error) {
    console.error("[RulesChat] access check failed:", error);
    return NextResponse.json({ error: "Could not check Rules Chat access" }, { status: 500 });
  }
}
