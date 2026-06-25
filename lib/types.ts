// Shared domain types for the Agent OS.

export type AgentId = string;

export interface AgentProfile {
  id: AgentId;
  name: string;
  role: string;
  systemPrompt: string;
  accent?: string;
}

export interface ChatMessage {
  id: string;
  ts: number;
  role: "user" | "assistant" | "system";
  agentId?: AgentId;
  text: string;
  source?: "web" | "telegram" | "loop";
}

export interface Verdict {
  pass: boolean;
  score: number; // 0-100
  feedback: string;
}

export interface Iteration {
  n: number;
  work: string;
  verdict: Verdict;
}

export type RunStatus = "running" | "done" | "failed" | "stopped";

export interface RunState {
  id: string;
  goal: string;
  dod: string; // definition of done
  agentId: AgentId;
  status: RunStatus;
  iterations: Iteration[];
  createdAt: number;
  error?: string;
}

export interface Artifact {
  id: string;
  name: string;
  kind: "markdown" | "code" | "text";
  lang?: string;
  content: string;
  runId?: string;
  ts: number;
}

export type BusEvent =
  | { type: "message"; data: ChatMessage }
  | { type: "artifact"; data: Artifact }
  | { type: "run"; data: RunState }
  | { type: "log"; data: { runId: string; line: string; ts: number } };
