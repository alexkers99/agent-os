#!/usr/bin/env node
"use strict";
// Nightly Brain Processor for the agent-os vault.
// Scans vault notes modified in the last 24h, extracts structured data via Hermes,
// files it into decisions/ people/ companies/ knowledge/, writes a daily summary,
// and commits the vault repo.
//
// ponytail: the spec said POST {BASE}/v1/messages (Anthropic format), but Hermes is an
//   OpenAI-compatible endpoint — POST {BASE}/chat/completions, reply at
//   choices[0].message.content (confirmed by scripts/probe-hermes.mjs). We call that.
//   If HERMES is ever repointed at a raw Anthropic API, switch postChat() to /v1/messages.

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { execSync } = require("child_process");

// ── env: no dotenv dep — same loader as scripts/probe-hermes.mjs ──
function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on real process env (e.g. set by the cron wrapper) */
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));

const BASE = (process.env.HERMES_BASE_URL || "").replace(/\/$/, "");
const KEY = process.env.HERMES_API_KEY || "";
const MODEL = process.env.HERMES_MODEL || "claude-sonnet-4-6";
const VAULT = path.resolve(process.env.AGENT_WORKSPACE_DIR || "./workspace", "vault");
const SKIP_GIT = process.argv.includes("--no-git") || process.env.BRAIN_NO_GIT === "1";

const DAY_MS = 24 * 60 * 60 * 1000;
const SKIP_TOP = new Set(["moc"]);
const SKIP_ROOT = new Set(["user.md", "soul.md", "identity.md", "CLAUDE.md"]);

function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const TODAY = ymd();

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ── Step 1: collect notes modified in the last 24h ──
// ponytail: only moc/ and root identity files are skipped (per spec). Generated folders
//   (daily/decisions/…) are bounded by the 24h window; if a same-time nightly cron starts
//   re-extracting yesterday's summaries, add them to SKIP_TOP.
function collectRecent() {
  const out = [];
  function walk(dir, relBase) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue; // .git, .obsidian
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!relBase && SKIP_TOP.has(e.name)) continue; // skip top-level moc/
        walk(path.join(dir, e.name), rel);
      } else if (e.name.toLowerCase().endsWith(".md")) {
        if (!relBase && SKIP_ROOT.has(e.name)) continue; // skip root identity files
        const full = path.join(dir, e.name);
        let st;
        try {
          st = fs.statSync(full);
        } catch {
          continue;
        }
        if (Date.now() - st.mtimeMs <= DAY_MS) {
          out.push({ full, rel, name: e.name.replace(/\.md$/i, "") });
        }
      }
    }
  }
  walk(VAULT, "");
  return out;
}

// ── Step 2: extract structured data via Hermes (OpenAI-compatible chat/completions) ──
const EXTRACT_PROMPT = (note) => `You are a knowledge extraction engine. Read this vault note and extract structured data.

Return ONLY valid JSON in this exact format:
{
  "decisions": [
    { "title": "short title", "detail": "what was decided and why", "date": "YYYY-MM-DD" }
  ],
  "people": [
    { "name": "Full Name", "role": "their role", "company": "company name", "note": "relevant detail" }
  ],
  "companies": [
    { "name": "Company Name", "type": "type of company", "note": "relevant detail" }
  ],
  "knowledge": [
    { "title": "short title", "insight": "the insight or framework" }
  ]
}

Return empty arrays if nothing found. No markdown, no explanation — only the JSON object.

Note content:
${note}`;

function postChat(messages) {
  return new Promise((resolve, reject) => {
    if (!BASE) return reject(new Error("HERMES_BASE_URL not set"));
    const u = new URL(BASE + "/chat/completions");
    const lib = u.protocol === "https:" ? https : http;
    const data = JSON.stringify({ model: MODEL, messages, max_tokens: 1024, temperature: 0, stream: false });
    const req = lib.request(
      u,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 200)}`));
          }
          try {
            resolve(JSON.parse(buf));
          } catch {
            reject(new Error("non-JSON response"));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function extract(noteContent) {
  const res = await postChat([{ role: "user", content: EXTRACT_PROMPT(noteContent) }]);
  const raw = res && res.choices && res.choices[0] && res.choices[0].message ? res.choices[0].message.content || "" : "";
  const m = raw.match(/\{[\s\S]*\}/); // tolerate stray prose around the JSON object
  if (!m) throw new Error("no JSON object in model reply");
  const j = JSON.parse(m[0]);
  const arr = (v) => (Array.isArray(v) ? v : []);
  return { decisions: arr(j.decisions), people: arr(j.people), companies: arr(j.companies), knowledge: arr(j.knowledge) };
}

// ── Step 3: file writers ──
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function appendFile(p, text) {
  ensureDir(path.dirname(p));
  fs.appendFileSync(p, text);
}
function writeFile(p, text) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, text);
}

function writeDecision(d, source) {
  const block = `## ${d.title || "Untitled"}\n**Date:** ${d.date || TODAY}\n**Detail:** ${d.detail || ""}\n**Source:** [[${source}]]\n\n`;
  appendFile(path.join(VAULT, "decisions", `${TODAY}.md`), block);
}

// Returns true when a NEW entity file was created (so we can list it as a new wikilink).
function upsertEntity(kind, name, frontmatter, body, appendNote) {
  const file = path.join(VAULT, kind, `${slug(name)}.md`);
  if (fs.existsSync(file)) {
    fs.appendFileSync(file, `\n${appendNote || ""}\n`);
    return false;
  }
  writeFile(file, frontmatter + body);
  return true;
}

function writeKnowledge(k, source) {
  const file = path.join(VAULT, "knowledge", `${TODAY}-${slug(k.title || "note")}.md`);
  writeFile(file, `---\ntags: [knowledge]\ntype: knowledge\n---\n# ${k.title || "Untitled"}\n${k.insight || ""}\n**Source:** [[${source}]]\n`);
}

async function main() {
  if (!fs.existsSync(VAULT)) {
    console.error(`Vault not found: ${VAULT}`);
    process.exit(1);
  }
  console.log(`Brain Processor — vault: ${VAULT}`);
  console.log(`Model: ${MODEL} · endpoint: ${BASE || "(unset)"}/chat/completions`);

  const notes = collectRecent();
  console.log(`Step 1: ${notes.length} note(s) modified in last 24h`);

  const processed = [];
  const newLinks = [];
  let nDec = 0;
  let nPeopleCo = 0;
  let nKnow = 0;

  for (const note of notes) {
    let content;
    try {
      content = fs.readFileSync(note.full, "utf8");
    } catch (e) {
      console.error(`  skip ${note.rel}: ${e.message}`);
      continue;
    }
    let data;
    try {
      data = await extract(content);
    } catch (e) {
      console.error(`  extract failed for ${note.rel}: ${e.message}`); // skip on API failure, keep going
      continue;
    }
    processed.push(note.rel);

    for (const d of data.decisions) {
      writeDecision(d, note.name);
      nDec++;
    }
    for (const p of data.people) {
      const fm = `---\ntags: [person]\ntype: person\nrole: ${p.role || ""}\ncompany: ${p.company || ""}\n---\n`;
      const body = `# ${p.name || "Unknown"}\n${p.note || ""}\n`;
      if (upsertEntity("people", p.name || "unknown", fm, body, p.note)) newLinks.push(`people/${slug(p.name || "unknown")}.md`);
      nPeopleCo++;
    }
    for (const c of data.companies) {
      // ponytail: companies frontmatter mirrors people; the company's own "type" goes in `category`
      // (spec gave people frontmatter explicitly, companies only as "same pattern").
      const fm = `---\ntags: [company]\ntype: company\ncategory: ${c.type || ""}\n---\n`;
      const body = `# ${c.name || "Unknown"}\n${c.note || ""}\n`;
      if (upsertEntity("companies", c.name || "unknown", fm, body, c.note)) newLinks.push(`companies/${slug(c.name || "unknown")}.md`);
      nPeopleCo++;
    }
    for (const k of data.knowledge) {
      writeKnowledge(k, note.name);
      nKnow++;
    }
    console.log(`  ✓ ${note.rel} → ${data.decisions.length}d ${data.people.length}p ${data.companies.length}c ${data.knowledge.length}k`);
  }

  // ── Step 4: daily summary ──
  const summary = `# Daily Brain Sync — ${TODAY}

## Processed Notes
${processed.length ? processed.map((f) => `- ${f}`).join("\n") : "- (none)"}

## Extracted
- ${nDec} decisions
- ${nPeopleCo} people/companies
- ${nKnow} knowledge items

## New Wikilinks Added
${newLinks.length ? newLinks.map((f) => `- ${f}`).join("\n") : "- (none)"}
`;
  writeFile(path.join(VAULT, "daily", `${TODAY}.md`), summary);
  console.log(`Step 4: wrote daily/${TODAY}.md`);

  // ── Step 5: commit the vault ──
  if (SKIP_GIT) {
    console.log("Step 5: git skipped (--no-git)");
    return;
  }
  try {
    execSync(`git add -A && git commit -m "brain: nightly sync ${TODAY}" && git push`, { cwd: VAULT, stdio: "inherit" });
    console.log("Step 5: committed + pushed");
  } catch (e) {
    console.error(`Step 5: git step skipped/failed (nothing to commit?): ${e.message}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
