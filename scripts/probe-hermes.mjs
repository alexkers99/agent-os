// Quick connectivity + sanity check for your Hermes endpoint.
//   npm run probe
// Reads .env.local, hits POST {HERMES_BASE_URL}/chat/completions, prints the reply.
import { readFileSync } from "fs";

function loadEnv(file = ".env.local") {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on process env */
  }
}
loadEnv();

const base = process.env.HERMES_BASE_URL;
const key = process.env.HERMES_API_KEY || "";
const model = process.env.HERMES_MODEL || "hermes";

if (!base) {
  console.error("✗ HERMES_BASE_URL is not set. Edit .env.local first.");
  process.exit(1);
}

const url = base.replace(/\/$/, "") + "/chat/completions";
console.log(`→ POST ${url}  (model: ${model})`);

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 16,
      stream: false,
    }),
  });

  if (!res.ok) {
    console.error(`✗ HTTP ${res.status} ${res.statusText}`);
    console.error((await res.text()).slice(0, 500));
    process.exit(1);
  }
  const json = await res.json();
  const reply = json?.choices?.[0]?.message?.content ?? "(no content field — check response shape)";
  console.log("✓ Hermes responded:", JSON.stringify(reply));
  console.log("  Endpoint is OpenAI-compatible and reachable. You're wired up.");
} catch (e) {
  console.error("✗ Request failed:", e.message);
  console.error("  Check the URL, that the VPS is up, and that any firewall allows this host.");
  process.exit(1);
}
