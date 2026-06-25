// File upload into the vault. Accepts multipart/form-data (field "file").
//  .md / .txt        → saved to knowledge/ as-is
//  .pdf / .docx      → text extracted (Node built-ins only) → knowledge/<name>.md
//  .zip              → extracted into the vault (path-confined, no zip-slip)
// Reuses lib/vault's root + ensureVault (import only — lib/vault is locked and its saveNote
// is .md-only, so non-.md writes go through fs here with our own path guard).
import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { vaultRoot, ensureVault } from "@/lib/vault";
import { unzip, docxToText, pdfToText } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([".md", ".txt", ".pdf", ".docx", ".zip"]);
const MAX_BYTES = 50 * 1024 * 1024; // ponytail: 50MB guard; raise if real uploads exceed it.

// Resolve a vault-relative path, rejecting traversal. Any extension allowed (unlike lib/vault.safeNotePath).
function safeVaultPath(rel: string): string {
  const root = vaultRoot();
  const clean = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  const p = path.resolve(root, clean);
  if (p !== root && !p.startsWith(root + path.sep)) throw new Error("path escapes the vault");
  return p;
}

function slugBase(name: string): string {
  return (
    path
      .basename(name)
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "upload"
  );
}

async function writeFile(rel: string, data: Buffer | string): Promise<void> {
  const dest = safeVaultPath(rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, data as Buffer);
}

export async function POST(req: Request) {
  await ensureVault();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "no file provided (form field 'file')" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return NextResponse.json({ success: false, error: `unsupported type '${ext || "unknown"}' (allowed: .md .txt .pdf .docx .zip)` }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ success: false, error: "empty file" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: `file too large (max ${MAX_BYTES / 1024 / 1024}MB)` }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  try {
    // .md / .txt → save to knowledge/, keep original extension
    if (ext === ".md" || ext === ".txt") {
      const filename = path.basename(file.name);
      const rel = `knowledge/${filename}`;
      await writeFile(rel, buf);
      return NextResponse.json({ success: true, path: rel, filename });
    }

    // .pdf / .docx → extract text → knowledge/<base>.md
    if (ext === ".pdf" || ext === ".docx") {
      const text = ext === ".pdf" ? pdfToText(buf) : docxToText(buf);
      const filename = `${slugBase(file.name)}.md`;
      const rel = `knowledge/${filename}`;
      const body =
        `---\ntags: [imported]\ntype: imported\nsource: ${ext.slice(1)}-upload\noriginal: ${path.basename(file.name)}\n---\n\n` +
        `# ${slugBase(file.name)}\n\n` +
        (text || "_No extractable text — the file may be scanned/image-based or use an unsupported encoding._") +
        "\n";
      await writeFile(rel, body);
      return NextResponse.json({ success: true, path: rel, filename, extractedChars: text.length });
    }

    // .zip → extract contents into the vault (path-confined)
    if (ext === ".zip") {
      const written: string[] = [];
      for (const entry of unzip(buf)) {
        if (!entry.name || entry.name.endsWith("/")) continue;
        let dest: string;
        try {
          dest = safeVaultPath(entry.name); // skip zip-slip / traversal entries
        } catch {
          continue;
        }
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, entry.data);
        written.push(path.relative(vaultRoot(), dest).replace(/\\/g, "/"));
      }
      if (written.length === 0) {
        return NextResponse.json({ success: false, error: "zip contained no extractable files" }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        path: path.dirname(written[0]) || "/",
        filename: path.basename(file.name),
        extracted: written.length,
        files: written.slice(0, 100),
      });
    }

    return NextResponse.json({ success: false, error: "unhandled file type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
