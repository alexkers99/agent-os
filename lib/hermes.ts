// Hermes = OpenAI-compatible endpoint on the Hostinger VPS (POST /v1/chat/completions).
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessage,
} from "openai/resources/chat/completions";

let client: OpenAI | null = null;

export function hermes(): OpenAI {
  if (client) return client;
  const baseURL = process.env.HERMES_BASE_URL;
  if (!baseURL) throw new Error("HERMES_BASE_URL is not set (see .env.example)");
  client = new OpenAI({
    baseURL,
    apiKey: process.env.HERMES_API_KEY || "sk-noauth", // OpenAI SDK requires a non-empty key even when the server ignores it
  });
  return client;
}

export const MODEL = () => process.env.HERMES_MODEL || "hermes";
// Anthropic's API requires max_tokens; OpenAI/OpenRouter treat it as optional. Always send it.
const MAX_TOKENS = () => Number(process.env.HERMES_MAX_TOKENS) || 4096;

/** Streaming text deltas for chat. */
export async function* chatStream(
  messages: ChatCompletionMessageParam[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const stream = await hermes().chat.completions.create(
    { model: MODEL(), messages, stream: true, temperature: 0.7, max_tokens: MAX_TOKENS() },
    { signal },
  );
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/** One non-streaming turn. Supports tool-calling when tools are provided. */
export async function complete(
  messages: ChatCompletionMessageParam[],
  opts?: { tools?: ChatCompletionTool[]; temperature?: number },
): Promise<ChatCompletionMessage> {
  const res = await hermes().chat.completions.create({
    model: MODEL(),
    messages,
    tools: opts?.tools,
    tool_choice: opts?.tools ? "auto" : undefined,
    temperature: opts?.temperature ?? 0.5,
    max_tokens: MAX_TOKENS(),
  });
  return res.choices[0].message;
}
