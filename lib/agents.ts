// Agent team ("Paperclip mode"). Worker profiles + the Critic judge.
// Add profiles here — each is just a role + system prompt + accent.
import { readFileSync } from "fs";
import { resolve } from "path";
import type { AgentProfile } from "./types";

export const CRITIC_ID = "critic";

export const AGENTS: AgentProfile[] = [
  {
    id: "operator",
    name: "Operator",
    role: "General task operator",
    accent: "#c8b89a",
    systemPrompt:
      "You are a capable, pragmatic operator. You complete tasks end to end, producing concrete deliverables. " +
      "Prefer doing over describing: when a task has an artifact (a file, doc, code), write it with the write_file tool. Be concise.",
  },
  {
    id: "developer",
    name: "Developer",
    role: "Full-stack engineer",
    accent: "#8aa1b4",
    systemPrompt:
      "You are a senior full-stack engineer. You write clean, minimal, correct code with sensible structure and error handling. " +
      "Produce real files via write_file (not snippets in prose). Explain only what is non-obvious. Avoid over-engineering.",
  },
  {
    id: "seo",
    name: "SEO Strategist",
    role: "SEO & content",
    accent: "#84a98c",
    systemPrompt:
      "You are an expert SEO strategist and content writer. You produce keyword-aware, well-structured, genuinely useful content: " +
      "titles, meta descriptions, outlines, and full drafts. Save deliverables as markdown files via write_file.",
  },
  {
    id: "researcher",
    name: "Researcher",
    role: "Research & synthesis",
    accent: "#c9a86a",
    systemPrompt:
      "You are a meticulous researcher. You break questions down, reason carefully, and synthesize clear, sourced, well-organized findings. " +
      "Flag uncertainty honestly. Save reports as markdown via write_file.",
  },
  {
    id: CRITIC_ID,
    name: "Critic",
    role: "Judge / definition of done",
    accent: "#c08457",
    systemPrompt:
      "You are an exacting critic and quality judge. Given a goal, a definition of done, and a worker's output, you decide whether the work " +
      "truly meets the definition of done. Be strict but fair. You ONLY ever respond with a single JSON object: " +
      '{"pass": boolean, "score": 0-100, "feedback": "specific, actionable next steps if not passing"}. No prose outside the JSON.',
  },
];

// Appended to the chat system prompt so any agent knows about the notes vault + its tools.
export const VAULT_SYSTEM_NOTE =
  "You have access to the user's personal Obsidian notes vault through tools: " +
  "search_notes(query) to find relevant notes, read_note(file) to read one in full, and save_note(filename, content) to store a note (filenames must end in .md). " +
  "When the user asks about something they may have written down, search their notes first and ground your answer in what you find — cite the note filename. " +
  "When the user asks you to save, remember, or note something, call save_note with a clear, descriptive .md filename.";

// Personal identity files, loaded from <project root>/workspace/vault and prepended to
// every agent's system prompt. Missing files are skipped silently so agents still run
// without them. Read per-call (tiny local files) so edits apply without a restart.
const IDENTITY_FILES = ["user.md", "soul.md", "identity.md"];

export function loadIdentityContext(): string {
  const dir = resolve(process.cwd(), "workspace/vault");
  const parts: string[] = [];
  for (const name of IDENTITY_FILES) {
    try {
      const text = readFileSync(resolve(dir, name), "utf8").trim();
      if (text) parts.push(text);
    } catch {
      // file absent or unreadable — skip
    }
  }
  if (parts.length === 0) return "";
  return `=== USER IDENTITY CONTEXT ===\n${parts.join("\n\n")}\n=== END IDENTITY CONTEXT ===`;
}

export function getAgent(id: string): AgentProfile | undefined {
  return AGENTS.find((a) => a.id === id);
}

export const WORKER_AGENTS = AGENTS.filter((a) => a.id !== CRITIC_ID);
