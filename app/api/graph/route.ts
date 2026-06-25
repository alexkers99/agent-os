// Vault graph — parses [[wikilinks]] across workspace/vault/*.md into nodes + edges.
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function vaultRoot(): string {
  return path.resolve(process.env.AGENT_WORKSPACE_DIR || "./workspace", "vault");
}

async function listMd(dir: string, base: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listMd(path.join(dir, e.name), rel)));
    else if (e.name.toLowerCase().endsWith(".md")) out.push(rel);
  }
  return out;
}

/** Wikilinks reference notes by basename (Obsidian style), so the node id is the basename without .md. */
function noteId(rel: string): string {
  return path.basename(rel).replace(/\.md$/i, "");
}

export async function GET() {
  const root = vaultRoot();
  const files = await listMd(root, "");
  const ids = new Set<string>(files.map(noteId));
  const incoming: Record<string, number> = {};
  const edges: { source: string; target: string }[] = [];
  const wikilink = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

  for (const f of files) {
    const source = noteId(f);
    let content = "";
    try {
      content = await fs.readFile(path.join(root, f), "utf8");
    } catch {
      /* skip */
    }
    let m: RegExpExecArray | null;
    while ((m = wikilink.exec(content)) !== null) {
      const target = m[1].trim().replace(/\.md$/i, "");
      if (!target || target === source) continue;
      edges.push({ source, target });
      incoming[target] = (incoming[target] || 0) + 1;
      ids.add(target); // include unresolved link targets as nodes (Obsidian behaviour)
    }
  }

  const nodes = [...ids].map((id) => ({ id, label: id, size: incoming[id] || 0 }));
  return NextResponse.json({ nodes, edges });
}
