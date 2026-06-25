// Canonical Obsidian-vault operations + the chat AI's vault tools.
// One source of truth for the vault path + path-confinement, shared by /api/notes and /api/chat.
import { promises as fs } from "fs";
import path from "path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export function vaultRoot(): string {
  return path.resolve(process.env.AGENT_WORKSPACE_DIR || "./workspace", "vault");
}

export async function ensureVault(): Promise<void> {
  await fs.mkdir(vaultRoot(), { recursive: true });
}

/** Resolve a note path inside the vault. Rejects traversal and non-.md files. */
export function safeNotePath(rel: string): string {
  if (!rel) throw new Error("file path required");
  if (!rel.toLowerCase().endsWith(".md")) throw new Error("only .md files are allowed");
  const root = vaultRoot();
  const p = path.resolve(root, rel);
  if (p !== root && !p.startsWith(root + path.sep)) throw new Error("path escapes the vault");
  return p;
}

async function walk(dir: string, base: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue; // skip .obsidian, .git
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(path.join(dir, e.name), rel)));
    else if (e.name.toLowerCase().endsWith(".md")) out.push(rel);
  }
  return out;
}

export async function listNotes(): Promise<string[]> {
  return (await walk(vaultRoot(), "")).sort();
}

export async function readNote(file: string): Promise<string> {
  return fs.readFile(safeNotePath(file), "utf8");
}

export async function saveNote(filename: string, content: string): Promise<{ file: string; bytes: number }> {
  const p = safeNotePath(filename);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
  return { file: filename, bytes: content.length };
}

export async function deleteNote(file: string): Promise<void> {
  await fs.unlink(safeNotePath(file));
}

/** Linear name+content search. ponytail: fine for a personal vault; index it if it ever gets huge. */
export async function searchNotes(query: string): Promise<{ file: string; snippet: string }[]> {
  const needle = query.toLowerCase().trim();
  if (!needle) return [];
  const files = await listNotes();
  const matches: { file: string; snippet: string }[] = [];
  for (const f of files) {
    const c = await fs.readFile(path.join(vaultRoot(), f), "utf8").catch(() => "");
    const lc = c.toLowerCase();
    const inName = f.toLowerCase().includes(needle);
    const idx = lc.indexOf(needle);
    if (inName || idx >= 0) {
      const snippet =
        idx >= 0 ? c.slice(Math.max(0, idx - 60), idx + 120).replace(/\s+/g, " ").trim() : c.slice(0, 120).trim();
      matches.push({ file: f, snippet });
    }
  }
  return matches;
}

// ───────────────────────── Chat AI tools (OpenAI function-calling format) ─────────────────────────

export const vaultToolSchemas: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_notes",
      description:
        "Search the knowledge vault for relevant notes. Call this FIRST before answering any question that might involve personal context, projects, people, or decisions. Use broad keywords.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_note",
      description: "Read the full markdown content of one note (use a path returned by search_notes).",
      parameters: {
        type: "object",
        properties: { file: { type: "string", description: "vault-relative .md path" } },
        required: ["file"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_note",
      description:
        "Save (create or overwrite) a markdown note in the vault. Use when the user asks to save, remember, or note something.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "e.g. 'ideas/launch.md' — must end in .md" },
          content: { type: "string" },
        },
        required: ["filename", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_note",
      description:
        "Update an existing note in the vault. Use when the user corrects or adds to existing information.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Existing filename to update (e.g. somnia.md)" },
          content: { type: "string", description: "New full content to replace the note with" },
        },
        required: ["filename", "content"],
      },
    },
  },
];

export async function execVaultTool(name: string, argsJson: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return "ERROR: invalid tool arguments JSON";
  }
  await ensureVault();
  try {
    switch (name) {
      case "search_notes": {
        const matches = await searchNotes(String(args.query || ""));
        return matches.length ? JSON.stringify(matches.slice(0, 10)) : `No notes matched "${args.query}".`;
      }
      case "read_note":
        return await readNote(String(args.file || ""));
      case "save_note": {
        if (typeof args.content !== "string") return "ERROR: content must be a string";
        const r = await saveNote(String(args.filename || ""), args.content);
        return `Saved ${r.file} (${r.bytes} bytes).`;
      }
      case "update_note": {
        // saveNote overwrites, so update == save with replace-intent for the model.
        if (typeof args.content !== "string") return "ERROR: content must be a string";
        const r = await saveNote(String(args.filename || ""), args.content);
        return `Updated ${r.file} (${r.bytes} bytes).`;
      }
      default:
        return `ERROR: unknown tool ${name}`;
    }
  } catch (e) {
    return "ERROR: " + (e as Error).message;
  }
}
