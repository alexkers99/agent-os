// Seed Protocol API — project management over workspace/projects/. Behind the auth gate.
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function projectsDir(): string {
  return path.resolve(process.env.AGENT_WORKSPACE_DIR || "./workspace", "projects");
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

function firstHeading(md: string): string | null {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

export async function GET(req: Request) {
  const dir = projectsDir();
  await fs.mkdir(dir, { recursive: true });
  const slug = new URL(req.url).searchParams.get("slug");

  // One project → raw project.md
  if (slug) {
    const p = path.resolve(dir, slug, "project.md");
    if (p !== path.join(dir, slug, "project.md") || !p.startsWith(dir + path.sep)) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    try {
      return new NextResponse(await fs.readFile(p, "utf8"), {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    } catch {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }

  // List all
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const projects: { slug: string; name: string }[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    let name = e.name;
    try {
      name = firstHeading(await fs.readFile(path.join(dir, e.name, "project.md"), "utf8")) || e.name;
    } catch {}
    projects.push({ slug: e.name, name });
  }
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  let body: {
    name?: string;
    description?: string;
    stack?: string;
    apis?: string;
    features?: string;
    deployment?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const slug = slugify(body.name);
  const dir = path.join(projectsDir(), slug);
  await fs.mkdir(dir, { recursive: true });

  const features =
    String(body.features || "")
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => `- ${f}`)
      .join("\n") || "- (none yet)";

  const md = `# ${body.name}

## Description
${body.description || ""}

## Tech Stack
${body.stack || ""}

## Integrations
${body.apis || ""}

## MVP Features
${features}

## Deployment
${body.deployment || ""}

## Created
${new Date().toISOString()}
`;

  await fs.writeFile(path.join(dir, "project.md"), md, "utf8");
  return NextResponse.json({ ok: true, slug, path: `workspace/projects/${slug}/project.md` });
}
