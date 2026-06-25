// Bridge for your EXISTING Telegram bot. The bot POSTs inbound messages here with a
// shared secret; they surface live in the console. `/goal <target> :: <done>` starts a loop.
//
// In your bot, on each message, add one HTTP call:
//   POST {APP_URL}/api/telegram
//   headers: { "x-bridge-secret": TELEGRAM_BRIDGE_SECRET, "content-type": "application/json" }
//   body: { "from": "<username>", "text": "<message text>", "chatId": "<id>" }
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { addMessage } from "@/lib/store";
import { publish } from "@/lib/bus";
import { startGoalRun } from "@/lib/loop";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = req.headers.get("x-bridge-secret");
  if (!process.env.TELEGRAM_BRIDGE_SECRET || secret !== process.env.TELEGRAM_BRIDGE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { from?: string; text?: string; agentId?: string } | null;
  if (!body?.text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const from = body.from || "telegram";
  const msg = {
    id: randomUUID().slice(0, 8),
    ts: Date.now(),
    role: "user" as const,
    text: `${from}: ${body.text}`,
    source: "telegram" as const,
  };
  addMessage(msg);
  publish({ type: "message", data: msg });

  // `/goal Build a landing page :: Page has hero, 3 features, CTA, and validates`
  if (body.text.startsWith("/goal ")) {
    const [goal, dod] = body.text.slice(6).split("::").map((s) => s.trim());
    if (goal) {
      const runId = startGoalRun({
        goal,
        dod: dod || "Complete the goal to a high, production-ready standard.",
        agentId: body.agentId || "operator",
      });
      return NextResponse.json({ ok: true, runId });
    }
  }

  return NextResponse.json({ ok: true });
}
