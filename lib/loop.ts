// Goal Mode: the autonomous loop. Worker produces work (with tools) → Critic judges
// against the definition of done → loop with feedback until PASS or iteration cap.
import { randomUUID } from "crypto";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { complete } from "./hermes";
import { toolSchemas, execTool } from "./tools";
import { getAgent, CRITIC_ID } from "./agents";
import { upsertRun, isStopped, clearStop } from "./store";
import { publish } from "./bus";
import type { RunState, Verdict, Iteration } from "./types";

const MAX_ITERS = () => Number(process.env.MAX_LOOP_ITERATIONS || 8);
const MAX_TOOL_STEPS = 6; // tool round-trips per worker turn before we force a final answer

export function startGoalRun(input: { goal: string; dod: string; agentId: string }): string {
  const id = randomUUID().slice(0, 8);
  const run: RunState = {
    id,
    goal: input.goal,
    dod: input.dod,
    agentId: input.agentId,
    status: "running",
    iterations: [],
    createdAt: Date.now(),
  };
  upsertRun(run);
  publish({ type: "run", data: run });

  // Fire and forget — the loop runs in-process and streams progress over the bus.
  runLoop(run).catch((err) => {
    run.status = "failed";
    run.error = String(err?.message || err);
    upsertRun(run);
    publish({ type: "run", data: run });
  });

  return id;
}

function log(runId: string, line: string): void {
  publish({ type: "log", data: { runId, line, ts: Date.now() } });
}

async function workerTurn(run: RunState, messages: ChatCompletionMessageParam[]): Promise<string> {
  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const msg = await complete(messages, { tools: toolSchemas, temperature: 0.5 });
    messages.push(msg as ChatCompletionMessageParam);

    const calls = msg.tool_calls;
    if (!calls || calls.length === 0) return msg.content || "";

    for (const call of calls) {
      log(run.id, `tool · ${call.function.name}`);
      let result: string;
      try {
        result = await execTool(call.function.name, call.function.arguments, run.id);
      } catch (e) {
        result = "ERROR: " + (e as Error).message;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  // Hit the tool-step cap — ask for a final answer with no more tools.
  messages.push({ role: "user", content: "Stop using tools. Give your final result now." });
  const final = await complete(messages, { temperature: 0.5 });
  messages.push(final as ChatCompletionMessageParam);
  return final.content || "";
}

function parseVerdict(raw: string): Verdict {
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      return { pass: !!j.pass, score: Number(j.score) || 0, feedback: String(j.feedback || "") };
    } catch {
      /* fall through to heuristic */
    }
  }
  const pass = /\b(pass(ed)?|approved|complete|done)\b/i.test(raw) && !/\bnot\b/i.test(raw);
  return { pass, score: pass ? 80 : 40, feedback: raw.slice(0, 500) || "Critic returned no parseable verdict." };
}

async function criticTurn(run: RunState, work: string): Promise<Verdict> {
  const critic = getAgent(CRITIC_ID)!;
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: critic.systemPrompt },
    {
      role: "user",
      content:
        `GOAL:\n${run.goal}\n\nDEFINITION OF DONE:\n${run.dod}\n\nWORKER OUTPUT:\n${work}\n\n` +
        `Respond with ONLY the JSON verdict object.`,
    },
  ];
  const msg = await complete(messages, { temperature: 0 });
  return parseVerdict(msg.content || "");
}

async function runLoop(run: RunState): Promise<void> {
  const agent = getAgent(run.agentId) || getAgent("operator")!;
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        `${agent.systemPrompt}\n\nYou have tools to read/write files and (when enabled) run shell commands inside a workspace. ` +
        `Use them to actually produce the deliverable — do not just describe it.`,
    },
    {
      role: "user",
      content: `GOAL:\n${run.goal}\n\nDEFINITION OF DONE:\n${run.dod}\n\nProduce the deliverable now.`,
    },
  ];

  for (let n = 1; n <= MAX_ITERS(); n++) {
    if (isStopped(run.id)) {
      run.status = "stopped";
      break;
    }
    log(run.id, `iteration ${n} · working`);
    const work = await workerTurn(run, messages);

    if (isStopped(run.id)) {
      run.status = "stopped";
      break;
    }
    log(run.id, `iteration ${n} · critic reviewing`);
    const verdict = await criticTurn(run, work);

    const iteration: Iteration = { n, work, verdict };
    run.iterations.push(iteration);
    upsertRun(run);
    publish({ type: "run", data: run });
    log(run.id, `iteration ${n} · ${verdict.pass ? "PASS" : "REJECT"} (${verdict.score})`);

    if (verdict.pass) {
      run.status = "done";
      break;
    }
    messages.push({
      role: "user",
      content:
        `The critic did NOT approve (score ${verdict.score}/100).\nFeedback: ${verdict.feedback}\n` +
        `Revise and improve until it meets the definition of done.`,
    });
  }

  if (run.status === "running") run.status = "failed"; // exhausted iterations without a pass
  clearStop(run.id);
  upsertRun(run);
  publish({ type: "run", data: run });
  log(run.id, `run ${run.status}`);
}
