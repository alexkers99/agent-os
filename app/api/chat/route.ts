// Streaming chat against Hermes. Streams raw text deltas; the client appends them.
import { randomUUID } from "crypto";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { chatStream } from "@/lib/hermes";
import { getAgent } from "@/lib/agents";
import { addMessage } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Incoming {
  messages?: { role: "user" | "assistant" | "system"; text?: string; content?: string }[];
  agentId?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Incoming;
  const agent = getAgent(body.agentId || "operator") || getAgent("operator")!;

  const history: ChatCompletionMessageParam[] = (body.messages || []).map((m) => ({
    role: m.role,
    content: m.text ?? m.content ?? "",
  }));
  const full: ChatCompletionMessageParam[] = [
    { role: "system", content: agent.systemPrompt },
    ...history,
  ];

  const lastUser = history[history.length - 1];
  if (lastUser?.role === "user") {
    addMessage({
      id: randomUUID().slice(0, 8),
      ts: Date.now(),
      role: "user",
      text: String(lastUser.content || ""),
      source: "web",
    });
  }

  const encoder = new TextEncoder();
  let acc = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of chatStream(full, req.signal)) {
          acc += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch (e) {
        controller.enqueue(encoder.encode("\n\n[error: " + (e as Error).message + "]"));
      } finally {
        addMessage({
          id: randomUUID().slice(0, 8),
          ts: Date.now(),
          role: "assistant",
          agentId: agent.id,
          text: acc,
          source: "web",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
