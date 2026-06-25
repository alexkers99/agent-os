// Chat history — conversations stored as workspace/history/<id>.json.
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number;
}
interface Conversation {
  id: string;
  title: string;
  created: string;
  messages: Message[];
}

function historyDir(): string {
  return path.resolve(process.env.AGENT_WORKSPACE_DIR || "./workspace", "history");
}
async function ensureDir(): Promise<void> {
  await fs.mkdir(historyDir(), { recursive: true });
}
/** Conversation ids are timestamps/uuids — reject anything that could traverse. */
function filePath(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("invalid id");
  return path.join(historyDir(), id + ".json");
}

export async function GET(req: Request) {
  await ensureDir();
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    try {
      return NextResponse.json(JSON.parse(await fs.readFile(filePath(id), "utf8")));
    } catch {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }

  let files: string[] = [];
  try {
    files = (await fs.readdir(historyDir())).filter((f) => f.endsWith(".json"));
  } catch {
    /* none yet */
  }
  const conversations: { id: string; title: string; created: string; preview: string }[] = [];
  for (const f of files) {
    try {
      const c = JSON.parse(await fs.readFile(path.join(historyDir(), f), "utf8")) as Conversation;
      conversations.push({
        id: c.id,
        title: c.title || "(untitled)",
        created: c.created,
        preview: c.messages?.[0]?.content?.slice(0, 80) || "",
      });
    } catch {
      /* skip corrupt */
    }
  }
  conversations.sort((a, b) => (a.created < b.created ? 1 : -1)); // newest first
  return NextResponse.json(conversations);
}

export async function POST(req: Request) {
  await ensureDir();
  let body: Partial<Conversation>;
  try {
    body = (await req.json()) as Partial<Conversation>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.id || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "id and messages[] are required" }, { status: 400 });
  }
  try {
    const convo: Conversation = {
      id: body.id,
      title: body.title || (body.messages.find((m) => m.role === "user")?.content || "New chat").slice(0, 40),
      created: body.created || new Date().toISOString(),
      messages: body.messages,
    };
    await fs.writeFile(filePath(body.id), JSON.stringify(convo, null, 2), "utf8");
    return NextResponse.json({ ok: true, id: body.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await fs.unlink(filePath(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
