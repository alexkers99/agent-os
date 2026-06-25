#!/usr/bin/env node
// Vault MCP server — JSON-RPC 2.0 over stdio, stdlib only (fs, path, readline).
// Exposes the agent-os Obsidian vault (workspace/vault) to MCP clients (e.g. Claude Desktop).
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Vault path: VAULT_DIR env > first CLI arg > default (../workspace/vault).
// Lets the same server run on the VPS (default) or locally against a synced clone.
const VAULT = process.env.VAULT_DIR
  ? path.resolve(process.env.VAULT_DIR)
  : process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, "../workspace/vault");

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function ensureVault() {
  try {
    fs.mkdirSync(VAULT, { recursive: true });
  } catch {
    /* ignore */
  }
}

// Resolve a vault-relative .md path, rejecting traversal and non-markdown files.
function safePath(filename) {
  if (!filename || typeof filename !== "string") throw { code: -32602, message: "filename is required" };
  if (!filename.toLowerCase().endsWith(".md")) throw { code: -32602, message: "only .md files are allowed" };
  const p = path.resolve(VAULT, filename);
  if (p !== VAULT && !p.startsWith(VAULT + path.sep)) throw { code: -32602, message: "path escapes the vault" };
  return p;
}

function listNotes() {
  ensureVault();
  const walk = (dir, base) => {
    let out = [];
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue; // skip .obsidian, .git
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) out = out.concat(walk(path.join(dir, e.name), rel));
      else if (e.name.toLowerCase().endsWith(".md")) out.push(rel);
    }
    return out;
  };
  return walk(VAULT, "").sort();
}

function readNote(filename) {
  const p = safePath(filename);
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    throw { code: -32602, message: "File not found: " + filename };
  }
}

function searchNotes(query) {
  const q = String(query || "").toLowerCase();
  const results = [];
  if (!q) return results;
  for (const f of listNotes()) {
    let content = "";
    try {
      content = fs.readFileSync(path.join(VAULT, f), "utf8");
    } catch {
      continue;
    }
    const idx = content.toLowerCase().indexOf(q);
    if (idx >= 0) {
      const excerpt = content
        .slice(Math.max(0, idx - 40), idx + 80)
        .replace(/\s+/g, " ")
        .trim();
      results.push({ filename: f, excerpt });
    }
  }
  return results;
}

function writeNote(filename, content) {
  const p = safePath(filename);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, String(content ?? ""), "utf8");
  return { ok: true, filename };
}

const TOOLS = [
  {
    name: "list_notes",
    description: "List all notes in the Obsidian vault",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_note",
    description: "Read a specific note from the Obsidian vault",
    inputSchema: {
      type: "object",
      properties: { filename: { type: "string", description: "e.g. somnia.md" } },
      required: ["filename"],
    },
  },
  {
    name: "search_notes",
    description: "Search vault notes by keyword",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "plain text, case-insensitive" } },
      required: ["query"],
    },
  },
  {
    name: "write_note",
    description: "Write or update a note in the Obsidian vault",
    inputSchema: {
      type: "object",
      properties: { filename: { type: "string" }, content: { type: "string" } },
      required: ["filename", "content"],
    },
  },
];

function callTool(name, args) {
  args = args || {};
  switch (name) {
    case "list_notes":
      return JSON.stringify(listNotes(), null, 2);
    case "read_note":
      return readNote(args.filename);
    case "search_notes":
      return JSON.stringify(searchNotes(args.query), null, 2);
    case "write_note":
      return JSON.stringify(writeNote(args.filename, args.content));
    default:
      throw { code: -32601, message: "Unknown tool: " + name };
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (raw) => {
  const line = raw.trim();
  if (!line) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return; // ignore non-JSON lines
  }
  const { id, method, params } = msg;

  // Notifications carry no id and expect no response.
  if (typeof method === "string" && method.startsWith("notifications/")) return;

  try {
    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "vault-mcp", version: "1.0.0" },
        },
      });
    } else if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    } else if (method === "tools/call") {
      const text = callTool(params && params.name, params && params.arguments);
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
    } else if (id !== undefined) {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } });
    }
  } catch (err) {
    const code = err && typeof err.code === "number" ? err.code : -32603;
    const message = (err && err.message) || String(err);
    if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code, message } });
  }
});
