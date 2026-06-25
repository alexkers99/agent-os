#!/usr/bin/env node
"use strict";
// Brain Compound — the weekly/monthly synthesis layer on top of brain-processor.js.
//   node scripts/brain-compound.js weekly    → knowledge/weekly-synthesis-YYYY-Www.md
//   node scripts/brain-compound.js monthly   → knowledge/compound-YYYY-MM.md
//
// ponytail: no git step here. The nightly brain-processor.js does `git add -A && push`,
//   so the synthesis note it writes ships on the next nightly run (within a day).
//   API call copies brain-processor.js's pattern: Hermes is OpenAI-compatible
//   (POST {BASE}/chat/completions, reply at choices[0].message.content).

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ── env: same loader as brain-processor.js / probe-hermes.mjs (no dotenv dep) ──
function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* rely on real process env */
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));

const BASE = (process.env.HERMES_BASE_URL || "").replace(/\/$/, "");
const KEY = process.env.HERMES_API_KEY || "";
const MODEL = process.env.HERMES_MODEL || "claude-sonnet-4-6";
const VAULT = path.resolve(process.env.AGENT_WORKSPACE_DIR || "./workspace", "vault");
const SYNTH_MAX_TOKENS = 2048;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ISO-8601 week number (Mon-based; the week with the year's first Thursday is week 1).
function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((date - firstThursday) / (7 * DAY_MS));
  return { year: date.getUTCFullYear(), week };
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const oneLine = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const vaultRel = (abs) => path.relative(VAULT, abs).replace(/\\/g, "/");

// ── shared IO ──
function readDirMd(sub) {
  try {
    return fs
      .readdirSync(path.join(VAULT, sub))
      .filter((f) => f.toLowerCase().endsWith(".md"))
      .map((f) => path.join(VAULT, sub, f));
  } catch {
    return [];
  }
}
function recent(paths, days) {
  const cutoff = Date.now() - days * DAY_MS;
  return paths.filter((p) => {
    try {
      return fs.statSync(p).mtimeMs >= cutoff;
    } catch {
      return false;
    }
  });
}
function inMonth(paths, year, monthIdx) {
  return paths.filter((p) => {
    try {
      const d = new Date(fs.statSync(p).mtimeMs);
      return d.getFullYear() === year && d.getMonth() === monthIdx;
    } catch {
      return false;
    }
  });
}
function bundle(paths) {
  return paths
    .map((p) => {
      try {
        return `### ${vaultRel(p)}\n${fs.readFileSync(p, "utf8").trim()}`;
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
function writeFile(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

// ── API (copied pattern from brain-processor.js) ──
function postChat(messages) {
  return new Promise((resolve, reject) => {
    if (!BASE) return reject(new Error("HERMES_BASE_URL not set"));
    const u = new URL(BASE + "/chat/completions");
    const lib = u.protocol === "https:" ? https : http;
    const data = JSON.stringify({ model: MODEL, messages, max_tokens: SYNTH_MAX_TOKENS, temperature: 0.3, stream: false });
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
          if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 200)}`));
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
async function synthesize(prompt) {
  const res = await postChat([{ role: "user", content: prompt }]);
  const raw = res && res.choices && res.choices[0] && res.choices[0].message ? res.choices[0].message.content || "" : "";
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON object in model reply");
  return JSON.parse(m[0]);
}
const arr = (v) => (Array.isArray(v) ? v : []);

// ── WEEKLY ──
const WEEKLY_PROMPT = (content) => `You are a strategic synthesis engine. You have been given a week of notes, decisions, and knowledge extracts from a personal vault.

Your job: synthesize this into a weekly intelligence report.

Return ONLY valid JSON:
{
  "themes": [
    { "title": "theme name", "observation": "what pattern or trend you observed across multiple notes" }
  ],
  "momentum": [
    { "project": "project name", "status": "moving/stalled/shifted", "evidence": "what in the notes shows this" }
  ],
  "emerging_risks": [
    { "risk": "short description", "evidence": "what in the notes suggests this risk" }
  ],
  "strategic_insights": [
    { "insight": "a non-obvious insight derived from connecting multiple notes", "connection": "what notes/decisions it connects" }
  ],
  "next_week_focus": ["top 3 things that should get attention next week based on patterns"]
}

Week content:
${content}`;

function renderWeekly(data, year, week) {
  const ww = String(week).padStart(2, "0");
  const themes = arr(data.themes).map((t) => `- **${oneLine(t.title) || "Theme"}** — ${oneLine(t.observation)}`).join("\n") || "_none_";
  const mom = arr(data.momentum);
  const momentum = mom.length
    ? "| Project | Status | Evidence |\n|---|---|---|\n" + mom.map((m) => `| ${oneLine(m.project)} | ${oneLine(m.status)} | ${oneLine(m.evidence)} |`).join("\n")
    : "_none_";
  const risks = arr(data.emerging_risks).map((r) => `> [!warning] ${oneLine(r.risk)}\n> ${oneLine(r.evidence)}`).join("\n\n") || "_none_";
  const insights = arr(data.strategic_insights).map((s, i) => `${i + 1}. ${oneLine(s.insight)} — _${oneLine(s.connection)}_`).join("\n") || "_none_";
  const focus = arr(data.next_week_focus).slice(0, 3).map((f) => `- [ ] ${oneLine(f)}`).join("\n") || "- [ ] (none)";

  return `---
tags: [synthesis, weekly]
type: weekly-synthesis
week: ${year}-${ww}
created: ${ymd()}
---

# Weekly Synthesis — W${ww} ${year}

## Themes
${themes}

## Project Momentum
${momentum}

## Emerging Risks
${risks}

## Strategic Insights
${insights}

## Next Week Focus
${focus}
`;
}

async function runWeekly() {
  const files = [
    ...recent(readDirMd("daily"), 7),
    ...recent(readDirMd("decisions"), 7),
    ...recent(readDirMd("knowledge"), 7),
    ...readDirMd("projects"), // all projects, for momentum
  ];
  console.log(`Weekly: ${files.length} file(s) in scope`);
  const content = bundle(files);
  if (!content) {
    console.log("Nothing to synthesize this week — no recent notes. Exiting.");
    return;
  }
  const { year, week } = isoWeek();
  const data = await synthesize(WEEKLY_PROMPT(content));
  const out = path.join(VAULT, "knowledge", `weekly-synthesis-${year}-W${String(week).padStart(2, "0")}.md`);
  writeFile(out, renderWeekly(data, year, week));
  console.log(`Wrote ${vaultRel(out)}`);
}

// ── MONTHLY ──
const MONTHLY_PROMPT = (content) => `You are a compounding intelligence engine. You have all weekly synthesis reports and knowledge notes from the past month.

Your job: identify what is compounding — what patterns repeat, what insights deepened, what shifted strategically.

Return ONLY valid JSON:
{
  "compounding_patterns": [
    { "pattern": "what keeps recurring", "significance": "why this matters strategically" }
  ],
  "belief_updates": [
    { "old_belief": "what you thought before", "new_belief": "what the month's evidence suggests instead" }
  ],
  "leverage_points": [
    { "area": "where to focus", "why": "what compound evidence supports this" }
  ],
  "monthly_summary": "3-4 sentence executive summary of the month"
}

Month content:
${content}`;

function renderMonthly(data, year, monthIdx) {
  const mm = String(monthIdx + 1).padStart(2, "0");
  const summary = oneLine(data.monthly_summary) || "(no summary)";
  const pats = arr(data.compounding_patterns);
  const patterns = pats.length
    ? "| Pattern | Significance |\n|---|---|\n" + pats.map((p) => `| ${oneLine(p.pattern)} | ${oneLine(p.significance)} |`).join("\n")
    : "_none_";
  const bel = arr(data.belief_updates);
  const beliefs = bel.length
    ? "| Before | After |\n|---|---|\n" + bel.map((b) => `| ${oneLine(b.old_belief)} | ${oneLine(b.new_belief)} |`).join("\n")
    : "_none_";
  const lev = arr(data.leverage_points).map((l, i) => `${i + 1}. **${oneLine(l.area)}** — ${oneLine(l.why)}`).join("\n") || "_none_";

  return `---
tags: [synthesis, monthly, compound]
type: monthly-compound
month: ${year}-${mm}
created: ${ymd()}
---

# Monthly Compound — ${MONTHS[monthIdx]} ${year}

> [!quote] Summary
> ${summary}

## Compounding Patterns
${patterns}

## Belief Updates
${beliefs}

## Leverage Points
${lev}
`;
}

async function runMonthly() {
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const knowledge = readDirMd("knowledge");
  const weeklies = inMonth(knowledge.filter((p) => path.basename(p).startsWith("weekly-synthesis-")), year, monthIdx);
  const others = inMonth(
    knowledge.filter((p) => {
      const b = path.basename(p);
      return !b.startsWith("weekly-synthesis-") && !b.startsWith("compound-");
    }),
    year,
    monthIdx,
  );
  console.log(`Monthly: ${weeklies.length} weekly synthesis + ${others.length} knowledge note(s) in scope`);
  const content = bundle([...weeklies, ...others]);
  if (!content) {
    console.log("Nothing to compound this month — no weekly syntheses or knowledge notes. Exiting.");
    return;
  }
  const data = await synthesize(MONTHLY_PROMPT(content));
  const out = path.join(VAULT, "knowledge", `compound-${year}-${String(monthIdx + 1).padStart(2, "0")}.md`);
  writeFile(out, renderMonthly(data, year, monthIdx));
  console.log(`Wrote ${vaultRel(out)}`);
}

async function main() {
  const mode = (process.argv[2] || "").toLowerCase();
  if (mode !== "weekly" && mode !== "monthly") {
    console.error("Usage: node scripts/brain-compound.js <weekly|monthly>");
    process.exit(1);
  }
  if (!fs.existsSync(VAULT)) {
    console.error(`Vault not found: ${VAULT}`);
    process.exit(1);
  }
  console.log(`Brain Compound (${mode}) — vault: ${VAULT}`);
  console.log(`Model: ${MODEL} · endpoint: ${BASE || "(unset)"}/chat/completions`);
  if (mode === "weekly") await runWeekly();
  else await runMonthly();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
