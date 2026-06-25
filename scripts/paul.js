#!/usr/bin/env node
// PAUL Engine CLI — a tiny state-machine that tracks development progress across
// long Claude Code sessions and prevents context drift. All state lives in .paul/
// (git-ignored). Standalone Node, no dependencies — mirrors the API in app/api/paul.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, ".paul");
const PAUL_FILE = path.join(DIR, "paul.json");
const STATE_FILE = path.join(DIR, "state.json");
const HISTORY_FILE = path.join(DIR, "history.log");
const HANDOFF_FILE = path.join(DIR, "handoff.md");

const now = () => new Date().toISOString();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

function requireInit() {
  if (!fs.existsSync(PAUL_FILE) || !fs.existsSync(STATE_FILE)) {
    console.error("PAUL not initialized. Run: node scripts/paul.js init");
    process.exit(1);
  }
}

const STATUS_LABEL = {
  complete: "[COMPLETE]",
  in_progress: "[IN PROGRESS]",
  pending: "[PENDING]",
};

const STATUS_EMOJI = {
  complete: "✅",
  in_progress: "🔄",
  pending: "⏳",
};

function cmdInit() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

  let created = false;
  if (!fs.existsSync(PAUL_FILE)) {
    writeJson(PAUL_FILE, {
      project: "agent-os",
      created: now(),
      phases: [
        { id: 1, name: "Foundation", status: "complete" },
        { id: 2, name: "PAUL Engine", status: "in_progress" },
        { id: 3, name: "Seed Protocol", status: "pending" },
        { id: 4, name: "Railway Deploy", status: "pending" },
        { id: 5, name: "Graphify MCP", status: "pending" },
      ],
    });
    created = true;
  }
  if (!fs.existsSync(STATE_FILE)) {
    writeJson(STATE_FILE, {
      current_phase: 2,
      loop_position: 0,
      last_updated: now(),
      last_action: "PAUL Engine initialized",
      context_pct: 0,
    });
    created = true;
  }
  console.log(created ? "OK PAUL initialized in .paul/" : "OK PAUL already initialized (no changes)");
}

function cmdStatus() {
  requireInit();
  const paul = readJson(PAUL_FILE);
  const state = readJson(STATE_FILE);
  const total = paul.phases.length;
  const phase = paul.phases.find((p) => p.id === state.current_phase);
  const name = phase ? phase.name : "Unknown";
  const label = phase ? STATUS_LABEL[phase.status] || `[${phase.status}]` : "[UNKNOWN]";

  console.log("=== PAUL ENGINE STATUS ===");
  console.log(`Project: ${paul.project}`);
  console.log(`Phase: ${state.current_phase}/${total} - ${name} ${label}`);
  console.log(`Loop: ${state.loop_position}`);
  console.log(`Context: ${state.context_pct}%`);
  console.log(`Last: ${state.last_action}`);
  console.log("=========================");
}

function cmdUnify(summary) {
  requireInit();
  if (!summary) {
    console.error('Usage: node scripts/paul.js unify "<summary>"');
    process.exit(1);
  }
  const state = readJson(STATE_FILE);
  const ts = now();
  state.loop_position += 1;
  state.last_updated = ts;
  state.last_action = summary;
  writeJson(STATE_FILE, state);
  fs.appendFileSync(HISTORY_FILE, `[${ts}] [Phase ${state.current_phase}] ${summary}\n`);
  console.log(`OK Unified: ${summary}`);
}

function cmdAdvance() {
  requireInit();
  const paul = readJson(PAUL_FILE);
  const state = readJson(STATE_FILE);
  const current = paul.phases.find((p) => p.id === state.current_phase);
  if (current) current.status = "complete";

  const next = paul.phases.find((p) => p.id === state.current_phase + 1);
  if (!next) {
    writeJson(PAUL_FILE, paul);
    console.log(`OK Phase ${state.current_phase} complete -> all phases done`);
    return;
  }
  next.status = "in_progress";
  const completed = state.current_phase;
  state.current_phase += 1;
  state.last_updated = now();
  state.last_action = `Advanced to Phase ${next.id}: ${next.name}`;
  writeJson(PAUL_FILE, paul);
  writeJson(STATE_FILE, state);
  console.log(`OK Phase ${completed} complete -> Phase ${next.id}: ${next.name}`);
}

function tail(file, n) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  return lines.slice(-n);
}

function buildHandoff(paul, state, historyLines) {
  const total = paul.phases.length;
  const phase = paul.phases.find((p) => p.id === state.current_phase);
  const name = phase ? phase.name : "Unknown";
  const roadmap = paul.phases
    .map((p) => `${STATUS_EMOJI[p.status] || "•"} ${p.id}. ${p.name} (${p.status})`)
    .join("\n");
  const history = historyLines.length ? historyLines.join("\n") : "(no history yet)";

  return `# PAUL HANDOFF — ${now()}

## Current State
- Project: ${paul.project}
- Phase: ${state.current_phase}/${total} — ${name}
- Loop: ${state.loop_position}
- Context: ${state.context_pct}%
- Last action: ${state.last_action}

## Phase Roadmap
${roadmap}

## Recent History (last 20 entries)
${history}

## Resume Instructions
Run: node scripts/paul.js resume
Then paste this file content to Claude Code with your next task.
`;
}

function cmdPause() {
  requireInit();
  const paul = readJson(PAUL_FILE);
  const state = readJson(STATE_FILE);
  const historyLines = tail(HISTORY_FILE, 20);
  fs.writeFileSync(HANDOFF_FILE, buildHandoff(paul, state, historyLines));
  console.log("OK Handoff saved to .paul/handoff.md");
}

function cmdResume() {
  if (!fs.existsSync(HANDOFF_FILE)) {
    console.error("No handoff found. Run: node scripts/paul.js pause");
    process.exit(1);
  }
  process.stdout.write(fs.readFileSync(HANDOFF_FILE, "utf8"));
  console.log("\nOK Context restored. Continue your task.");
}

function cmdSetContext(value) {
  requireInit();
  const pct = Number(value);
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
    console.error("Usage: node scripts/paul.js set-context <0-100>");
    process.exit(1);
  }
  const state = readJson(STATE_FILE);
  state.context_pct = pct;
  state.last_updated = now();
  writeJson(STATE_FILE, state);
  if (pct >= 85) console.log(`WARNING Context at ${pct}% - consider paul pause.`);
  console.log(`OK Context: ${pct}%`);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "init":
      return cmdInit();
    case "status":
      return cmdStatus();
    case "unify":
      return cmdUnify(rest.join(" ").trim());
    case "advance":
      return cmdAdvance();
    case "pause":
      return cmdPause();
    case "resume":
      return cmdResume();
    case "set-context":
      return cmdSetContext(rest[0]);
    default:
      console.log("PAUL Engine — usage:");
      console.log("  node scripts/paul.js init");
      console.log("  node scripts/paul.js status");
      console.log('  node scripts/paul.js unify "<summary>"');
      console.log("  node scripts/paul.js advance");
      console.log("  node scripts/paul.js pause");
      console.log("  node scripts/paul.js resume");
      console.log("  node scripts/paul.js set-context <0-100>");
      if (cmd) process.exit(1);
  }
}

main();
