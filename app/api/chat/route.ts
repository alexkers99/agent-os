// Chat against Hermes/Anthropic, augmented with vault tools (search/read/save notes).
// Resolves any tool calls server-side, then returns the final answer.
// ponytail: tool-resolution is non-streaming for reliability (Anthropic's OpenAI-compat layer
//           is fussy about streamed tool_calls). The final answer is sent in one chunk — restore
//           token streaming later with streamed tool_call accumulation if the UX needs it.
import { randomUUID } from "crypto";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { complete } from "@/lib/hermes";
import { getAgent, VAULT_SYSTEM_NOTE } from "@/lib/agents";
import { vaultToolSchemas, execVaultTool } from "@/lib/vault";
import { addMessage } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOOL_STEPS = 5;

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
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: `${agent.systemPrompt}\n\n${VAULT_SYSTEM_NOTE}` },
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

  let answer = "";
  try {
    // Each step may call vault tools; the final step runs without tools to force an answer.
    for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
      const useTools = step < MAX_TOOL_STEPS;
      const msg = await complete(messages, { tools: useTools ? vaultToolSchemas : undefined, temperature: 0.7 });

      if (!msg.tool_calls?.length) {
        answer = msg.content || "";
        break;
      }
      messages.push(msg as ChatCompletionMessageParam);
      for (const call of msg.tool_calls) {
        const result = await execVaultTool(call.function.name, call.function.arguments);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }
  } catch (e) {
    answer = "[error: " + (e as Error).message + "]";
  }
  if (!answer) answer = "(no response)";

  addMessage({
    id: randomUUID().slice(0, 8),
    ts: Date.now(),
    role: "assistant",
    agentId: agent.id,
    text: answer,
    source: "web",
  });

  // Return through the streaming interface the client already reads (single chunk).
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(answer));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
