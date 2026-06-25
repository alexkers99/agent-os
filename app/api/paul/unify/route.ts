import { NextResponse } from "next/server";
import { isInitialized, unify } from "@/lib/paul";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/paul/unify { summary } — bump the loop and log a progress entry.
export async function POST(req: Request) {
  if (!(await isInitialized())) {
    return NextResponse.json({ error: "PAUL not initialized" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  if (!summary) {
    return NextResponse.json({ error: "summary is required" }, { status: 400 });
  }
  const state = await unify(summary);
  return NextResponse.json({ ok: true, state });
}
