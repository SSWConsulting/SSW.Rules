import { NextResponse } from "next/server";
import { getMegamenu } from "@/utils/get-mega-menu";

export async function GET() {
  try {
    const data = await getMegamenu();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error fetching megamenu from Tina:", error);
    return NextResponse.json({ error: "Failed to fetch megamenu", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
