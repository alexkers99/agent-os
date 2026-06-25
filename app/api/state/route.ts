import { NextResponse } from "next/server";
import { snapshot } from "@/lib/store";
import { AGENTS } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Initial hydration for the console: agent roster + current runs/artifacts/messages.
export async function GET() {
  return NextResponse.json({ agents: AGENTS, ...snapshot() });
}
