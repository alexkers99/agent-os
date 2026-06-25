// Goal Mode control: start an autonomous loop, or stop a running one.
import { NextResponse } from "next/server";
import { startGoalRun } from "@/lib/loop";
import { requestStop } from "@/lib/store";

export const runtime = "nodejs";

interface Body {
  action?: "start" | "stop";
  goal?: string;
  dod?: string;
  agentId?: string;
  runId?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (body.action === "stop") {
    if (!body.runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
    requestStop(body.runId);
    return NextResponse.json({ ok: true });
  }

  if (!body.goal || !body.dod) {
    return NextResponse.json({ error: "goal and dod are required" }, { status: 400 });
  }
  const runId = startGoalRun({ goal: body.goal, dod: body.dod, agentId: body.agentId || "operator" });
  return NextResponse.json({ runId });
}
