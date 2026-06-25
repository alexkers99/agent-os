// PAUL pause → generate a handoff from .paul state, write .paul/handoff.md, return it.
// ponytail: handoff format inferred from the /api/paul/status shape — align with scripts/paul.js if it differs.
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Phase {
  number?: number;
  name?: string;
  title?: string;
  status?: string;
}
interface PaulState {
  current_phase?: number | string;
  loop_position?: number | string;
  context_pct?: number;
  last_action?: string;
  last_updated?: string;
}

function paulDir(): string {
  return path.resolve(process.cwd(), ".paul");
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(paulDir(), file), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function POST() {
  const paul = await readJson<{ phases?: Phase[] }>("paul.json");
  const state = (await readJson<PaulState>("state.json")) || {};

  let history = "";
  try {
    const log = await fs.readFile(path.join(paulDir(), "history.log"), "utf8");
    history = log.trim().split("\n").slice(-20).join("\n");
  } catch {
    /* no history yet */
  }

  const phases = paul?.phases || [];
  const roadmap =
    phases
      .map((p, i) => {
        const num = p.number ?? i + 1;
        const name = p.name ?? p.title ?? "(unnamed)";
        return `${num}. ${name}${p.status ? ` — ${p.status}` : ""}`;
      })
      .join("\n") || "(no phases)";

  const handoff = `# PAUL Handoff — ${new Date().toISOString()}

## Current State
- Phase: ${state.current_phase ?? "?"}
- Loop position: ${state.loop_position ?? "?"}
- Context: ${state.context_pct ?? "?"}%
- Last action: ${state.last_action ?? "—"}
- Last updated: ${state.last_updated ?? "—"}

## Phase Roadmap
${roadmap}

## Recent History (last 20)
${history || "(empty)"}

## Resume
Continue from phase ${state.current_phase ?? "?"}, loop position ${state.loop_position ?? "?"}.
`;

  try {
    await fs.mkdir(paulDir(), { recursive: true });
    await fs.writeFile(path.join(paulDir(), "handoff.md"), handoff, "utf8");
  } catch {
    /* best effort — still return the handoff text */
  }

  return NextResponse.json({ ok: true, handoff });
}
