import { NextResponse } from "next/server";
import { advance, isInitialized } from "@/lib/paul";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/paul/advance — complete the current phase and move to the next.
export async function POST() {
  if (!(await isInitialized())) {
    return NextResponse.json({ error: "PAUL not initialized" }, { status: 404 });
  }
  const phase = await advance();
  return NextResponse.json({ ok: true, phase });
}
