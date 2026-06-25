import { NextResponse } from "next/server";
import { isInitialized, readPaul, readState } from "@/lib/paul";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/paul/status — current PAUL state machine, or 404 if not initialized.
export async function GET() {
  if (!(await isInitialized())) {
    return NextResponse.json({ error: "PAUL not initialized" }, { status: 404 });
  }
  const [paul, state] = await Promise.all([readPaul(), readState()]);
  return NextResponse.json({ paul, state });
}
