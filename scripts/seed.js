#!/usr/bin/env node
// Seed Protocol CLI — interview a new project into workspace/projects/<slug>/project.md.
//   node scripts/seed.js init          interactive new project
//   node scripts/seed.js list          list projects
//   node scripts/seed.js show <slug>   print a project.md
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const PROJECTS_DIR = path.resolve(process.cwd(), process.env.AGENT_WORKSPACE_DIR || "workspace", "projects");

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

function renderProjectMd(d) {
  const features =
    String(d.features || "")
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => `- ${f}`)
      .join("\n") || "- (none yet)";
  return `# ${d.name}

## Description
${d.description || ""}

## Tech Stack
${d.stack || ""}

## Integrations
${d.apis || ""}

## MVP Features
${features}

## Deployment
${d.deployment || ""}

## Created
${new Date().toISOString()}
`;
}

function writeProject(d) {
  const slug = slugify(d.name);
  const dir = path.join(PROJECTS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "project.md"), renderProjectMd(d), "utf8");
  return slug;
}

function firstHeading(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      let name = e.name;
      try {
        name = firstHeading(fs.readFileSync(path.join(PROJECTS_DIR, e.name, "project.md"), "utf8")) || e.name;
      } catch {}
      return { slug: e.name, name };
    });
}

async function init() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));
  console.log("\nWelcome to Seed Protocol.\n");
  const d = {};
  d.name = await ask("Project name: ");
  d.description = await ask("Description (one line): ");
  d.stack = await ask("Tech stack (e.g. Next.js, PostgreSQL): ");
  d.apis = await ask("Key APIs / integrations: ");
  d.features = await ask("MVP features (comma-separated): ");
  d.deployment = await ask("Deployment target (e.g. Railway, VPS): ");
  rl.close();
  if (!d.name) {
    console.error("\n✗ Project name is required.");
    process.exit(1);
  }
  const slug = writeProject(d);
  console.log(`\n✓ project.md saved to workspace/projects/${slug}/project.md`);
}

function show(slug) {
  if (!slug) {
    console.error("Usage: seed show <slug>");
    process.exit(1);
  }
  try {
    process.stdout.write(fs.readFileSync(path.join(PROJECTS_DIR, slug, "project.md"), "utf8"));
  } catch {
    console.error(`✗ No project '${slug}' found.`);
    process.exit(1);
  }
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case "init":
    init();
    break;
  case "list": {
    const projects = listProjects();
    if (!projects.length) {
      console.log("No projects yet. Run: node scripts/seed.js init");
      break;
    }
    for (const p of projects) console.log(`${p.slug}  —  ${p.name}`);
    break;
  }
  case "show":
    show(arg);
    break;
  default:
    console.log(
      "Seed Protocol — usage:\n  seed init           interactive new project\n  seed list           list projects\n  seed show <slug>    print a project.md",
    );
}
