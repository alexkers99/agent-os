// Shared helpers for the PAUL Engine HTTP API. State lives in .paul/ at the project
// root (git-ignored) and is written by both the CLI (scripts/paul.js) and these routes.
import { promises as fs } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), ".paul");
const PAUL_FILE = path.join(DIR, "paul.json");
const STATE_FILE = path.join(DIR, "state.json");
const HISTORY_FILE = path.join(DIR, "history.log");

export interface Phase {
  id: number;
  name: string;
  status: "complete" | "in_progress" | "pending";
}
export interface Paul {
  project: string;
  created: string;
  phases: Phase[];
}
export interface State {
  current_phase: number;
  loop_position: number;
  last_updated: string;
  last_action: string;
  context_pct: number;
}

export class NotInitializedError extends Error {}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function isInitialized(): Promise<boolean> {
  return (await exists(PAUL_FILE)) && (await exists(STATE_FILE));
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, "utf8")) as T;
}

async function writeJson(file: string, obj: unknown): Promise<void> {
  await fs.writeFile(file, JSON.stringify(obj, null, 2) + "\n");
}

export async function readPaul(): Promise<Paul> {
  if (!(await isInitialized())) throw new NotInitializedError("PAUL not initialized");
  return readJson<Paul>(PAUL_FILE);
}

export async function readState(): Promise<State> {
  if (!(await isInitialized())) throw new NotInitializedError("PAUL not initialized");
  return readJson<State>(STATE_FILE);
}

export async function unify(summary: string): Promise<State> {
  const state = await readState();
  const ts = new Date().toISOString();
  state.loop_position += 1;
  state.last_updated = ts;
  state.last_action = summary;
  await writeJson(STATE_FILE, state);
  await fs.appendFile(HISTORY_FILE, `[${ts}] [Phase ${state.current_phase}] ${summary}\n`);
  return state;
}

export async function advance(): Promise<Phase> {
  const paul = await readPaul();
  const state = await readState();
  const current = paul.phases.find((p) => p.id === state.current_phase);
  if (current) current.status = "complete";

  const next = paul.phases.find((p) => p.id === state.current_phase + 1);
  if (!next) {
    await writeJson(PAUL_FILE, paul);
    return current ?? paul.phases[paul.phases.length - 1];
  }
  next.status = "in_progress";
  state.current_phase += 1;
  state.last_updated = new Date().toISOString();
  state.last_action = `Advanced to Phase ${next.id}: ${next.name}`;
  await writeJson(PAUL_FILE, paul);
  await writeJson(STATE_FILE, state);
  return next;
}
