// MCP-style local tools the agent loop can call via OpenAI tool-calling.
// All file + shell access is confined to AGENT_WORKSPACE_DIR.
// ponytail: workspace-confined + 60s timeout + master flag — NOT a hardened sandbox.
//          Run on a trusted VPS. For untrusted goals, put run_shell behind a container.
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { addArtifact } from "./store";
import { publish } from "./bus";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Artifact } from "./types";

const execAsync = promisify(exec);

function root(): string {
  return path.resolve(process.env.AGENT_WORKSPACE_DIR || "./workspace");
}
async function ensureRoot(): Promise<void> {
  await fs.mkdir(root(), { recursive: true });
}
/** Resolve a relative path and refuse anything that escapes the workspace. */
function safe(rel: string): string {
  const r = root();
  const p = path.resolve(r, rel);
  if (p !== r && !p.startsWith(r + path.sep)) throw new Error(`path '${rel}' escapes the workspace`);
  return p;
}

const CODE_EXT: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", py: "python",
  json: "json", html: "html", css: "css", sh: "bash", go: "go", rs: "rust",
  sql: "sql", yml: "yaml", yaml: "yaml", toml: "toml", env: "bash",
};
function kindFor(name: string): { kind: Artifact["kind"]; lang?: string } {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "md" || ext === "markdown") return { kind: "markdown" };
  if (CODE_EXT[ext]) return { kind: "code", lang: CODE_EXT[ext] };
  return { kind: "text" };
}

export const toolSchemas: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a file in the workspace. Use this for every deliverable (code, markdown, docs).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "relative path within the workspace" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file from the workspace.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files in a workspace directory.",
      parameters: { type: "object", properties: { path: { type: "string", description: "relative dir, default '.'" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "run_shell",
      description: "Run a shell command inside the workspace. Only works if the operator enabled it.",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
    },
  },
];

export async function execTool(name: string, argsJson: string, runId?: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return "ERROR: arguments were not valid JSON";
  }
  await ensureRoot();

  switch (name) {
    case "write_file": {
      const rel = args.path as string;
      const content = args.content;
      if (!rel || typeof content !== "string") return "ERROR: need 'path' and string 'content'";
      const p = safe(rel);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, content, "utf8");
      const { kind, lang } = kindFor(rel);
      const art: Artifact = { id: randomUUID().slice(0, 8), name: rel, kind, lang, content, runId, ts: Date.now() };
      addArtifact(art);
      publish({ type: "artifact", data: art });
      return `wrote ${rel} (${content.length} bytes)`;
    }
    case "read_file": {
      try {
        return await fs.readFile(safe(args.path as string), "utf8");
      } catch (e) {
        return "ERROR: " + (e as Error).message;
      }
    }
    case "list_dir": {
      try {
        const items = await fs.readdir(safe((args.path as string) || "."), { withFileTypes: true });
        return items.map((i) => (i.isDirectory() ? i.name + "/" : i.name)).join("\n") || "(empty)";
      } catch (e) {
        return "ERROR: " + (e as Error).message;
      }
    }
    case "run_shell": {
      if (process.env.ALLOW_SHELL !== "true") return "ERROR: shell is disabled (set ALLOW_SHELL=true to enable)";
      const command = args.command as string;
      if (!command) return "ERROR: need 'command'";
      try {
        const { stdout, stderr } = await execAsync(command, { cwd: root(), timeout: 60_000, maxBuffer: 1024 * 1024 });
        return (stdout + (stderr ? "\n[stderr]\n" + stderr : "")).slice(0, 8000) || "(no output)";
      } catch (e) {
        return "ERROR: " + (e as Error).message;
      }
    }
    default:
      return `ERROR: unknown tool '${name}'`;
  }
}
