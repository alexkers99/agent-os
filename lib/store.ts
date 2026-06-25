// In-memory state. ponytail: process-local maps, capped to avoid unbounded growth.
// Persisted nowhere — restart clears it. Add SQLite/Redis only if you need history across restarts.
import type { Artifact, ChatMessage, RunState } from "./types";

interface Mem {
  runs: Map<string, RunState>;
  artifacts: Artifact[];
  messages: ChatMessage[];
  stop: Set<string>;
}

const g = globalThis as unknown as { __agentos_mem?: Mem };
const mem: Mem = (g.__agentos_mem ??= {
  runs: new Map(),
  artifacts: [],
  messages: [],
  stop: new Set(),
});

export function addArtifact(a: Artifact): void {
  mem.artifacts.unshift(a);
  if (mem.artifacts.length > 200) mem.artifacts.pop();
}

export function upsertRun(r: RunState): void {
  mem.runs.set(r.id, r);
}

export function listRuns(): RunState[] {
  return [...mem.runs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function addMessage(m: ChatMessage): void {
  mem.messages.push(m);
  if (mem.messages.length > 300) mem.messages.shift();
}

export function requestStop(id: string): void {
  mem.stop.add(id);
}
export function isStopped(id: string): boolean {
  return mem.stop.has(id);
}
export function clearStop(id: string): void {
  mem.stop.delete(id);
}

export function snapshot() {
  return { runs: listRuns(), artifacts: mem.artifacts, messages: mem.messages };
}
