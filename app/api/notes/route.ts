// Obsidian-compatible notes vault API. Thin HTTP layer over lib/vault (shared with the chat AI).
// Behind the auth gate (middleware), like the rest of the app.
import { NextResponse } from "next/server";
import { ensureVault, listNotes, readNote, saveNote, deleteNote, searchNotes } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureVault();
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  const q = url.searchParams.get("q");

  if (file) {
    try {
      return new NextResponse(await readNote(file), {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  if (q) {
    const results = await searchNotes(q);
    return NextResponse.json({ query: q, matches: results.map((r) => r.file), results });
  }

  const files = await listNotes();
  return NextResponse.json({ files, count: files.length });
}

export async function POST(req: Request) {
  await ensureVault();
  let body: { filename?: string; content?: string };
  try {
    body = (await req.json()) as { filename?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.filename || typeof body.content !== "string") {
    return NextResponse.json({ error: "filename and string content are required" }, { status: 400 });
  }
  try {
    const r = await saveNote(body.filename, body.content);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const file = new URL(req.url).searchParams.get("file");
  if (!file) return NextResponse.json({ error: "file query param required" }, { status: 400 });
  try {
    await deleteNote(file);
    return NextResponse.json({ ok: true, file });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
