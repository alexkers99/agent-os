// Obsidian-compatible notes vault API. Files live in workspace/vault, .md only,
// strictly confined to the vault dir. Behind the auth gate (middleware), like the rest of the app.
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function vaultRoot(): string {
  return path.resolve(process.env.AGENT_WORKSPACE_DIR || "./workspace", "vault");
}

async function ensureVault(): Promise<void> {
  await fs.mkdir(vaultRoot(), { recursive: true });
}

/** Resolve a note path inside the vault. Rejects traversal and non-.md files. */
function safeNotePath(rel: string): string {
  if (!rel) throw new Error("file path required");
  if (!rel.toLowerCase().endsWith(".md")) throw new Error("only .md files are allowed");
  const root = vaultRoot();
  const p = path.resolve(root, rel);
  if (p !== root && !p.startsWith(root + path.sep)) throw new Error("path escapes the vault");
  return p;
}

/** Recursively list .md files (vault-relative), skipping dotdirs (.obsidian, .git). */
async function listMarkdown(dir: string, base: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listMarkdown(full, rel)));
    else if (e.name.toLowerCase().endsWith(".md")) out.push(rel);
  }
  return out;
}

export async function GET(req: Request) {
  await ensureVault();
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  const q = url.searchParams.get("q");

  // Read one note → raw markdown
  if (file) {
    try {
      const content = await fs.readFile(safeNotePath(file), "utf8");
      return new NextResponse(content, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  // Search by name or content (ponytail: linear scan — fine for a personal vault)
  if (q) {
    const needle = q.toLowerCase();
    const files = await listMarkdown(vaultRoot(), "");
    const matches: string[] = [];
    for (const f of files) {
      if (f.toLowerCase().includes(needle)) {
        matches.push(f);
        continue;
      }
      const c = await fs.readFile(path.join(vaultRoot(), f), "utf8").catch(() => "");
      if (c.toLowerCase().includes(needle)) matches.push(f);
    }
    return NextResponse.json({ query: q, matches });
  }

  // List all notes
  const files = await listMarkdown(vaultRoot(), "");
  return NextResponse.json({ files: files.sort(), count: files.length });
}

export async function POST(req: Request) {
  await ensureVault();
  let body: { filename?: string; content?: string };
  try {
    body = (await req.json()) as { filename?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { filename, content } = body;
  if (!filename || typeof content !== "string") {
    return NextResponse.json({ error: "filename and string content are required" }, { status: 400 });
  }
  try {
    const p = safeNotePath(filename);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, "utf8");
    return NextResponse.json({ ok: true, file: filename, bytes: content.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  if (!file) return NextResponse.json({ error: "file query param required" }, { status: 400 });
  try {
    await fs.unlink(safeNotePath(file));
    return NextResponse.json({ ok: true, file });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
