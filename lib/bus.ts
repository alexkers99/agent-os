// In-memory pub/sub for live UI updates (loop progress, artifacts, telegram).
// ponytail: single-process in-memory bus — fine for one VPS. Swap for Redis pub/sub if you ever run >1 instance.
import type { BusEvent } from "./types";

type Sub = (e: BusEvent) => void;

const g = globalThis as unknown as { __agentos_subs?: Set<Sub> };
const subs: Set<Sub> = (g.__agentos_subs ??= new Set());

export function subscribe(fn: Sub): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function publish(e: BusEvent): void {
  for (const fn of subs) {
    try {
      fn(e);
    } catch {
      /* a dead subscriber must not break the publisher */
    }
  }
}
