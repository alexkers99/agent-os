# Agent OS

A premium, minimalist console for autonomous agents — built around your existing **Hermes** (OpenAI-compatible) endpoint and **Telegram** bot.

- **Chat** — stream conversations with any agent profile against Hermes.
- **Goal Mode** — give an agent a target + a definition of done. It works, a **Critic** agent judges, and it loops until it passes (or hits the iteration cap).
- **Agent team** — swappable profiles (Operator, Developer, SEO, Researcher) + the Critic judge. Run several goals in parallel.
- **Workspace** — files agents write appear live in the right-hand panel (code, markdown, docs).
- **Tools** — agents read/write files and run shell commands, confined to `./workspace`.
- **Telegram bridge** — your existing bot POSTs messages in; they appear live and can trigger goals.

Single Next.js app. One process. Dark "quiet luxury" UI per [DESIGN.md](./DESIGN.md).

---

## 1. Configure

```bash
cp .env.example .env.local   # (.env.local already exists — just edit it)
```

Set your Hermes endpoint in `.env.local`:

```ini
HERMES_BASE_URL=https://your-vps-domain.com/v1   # must speak POST /v1/chat/completions
HERMES_API_KEY=sk-...                            # blank if unauthenticated
HERMES_MODEL=hermes                              # your model name, passed through as-is
TELEGRAM_BRIDGE_SECRET=<openssl rand -hex 24>
ALLOW_SHELL=false                                # set true to let agents run shell in ./workspace
```

Verify the endpoint:

```bash
npm run probe
```

## 2. Run (dev)

```bash
npm install
npm run dev
# open http://localhost:3000
```

## 3. Deploy (Hostinger VPS)

```bash
npm install
npm run build
pm2 start ecosystem.config.js && pm2 save
```

Put nginx (or Caddy) in front of port 3000 for TLS. Example nginx location:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Connection '';
  proxy_set_header Host $host;
  chunked_transfer_encoding off;   # keep SSE flowing
  proxy_buffering off;             # keep SSE flowing
}
```

## 4. Wire your Telegram bot

Your existing bot stays as-is. On each inbound message, add one HTTP call:

```
POST  https://your-app-domain.com/api/telegram
headers:  x-bridge-secret: <TELEGRAM_BRIDGE_SECRET>
          content-type: application/json
body:     { "from": "<username>", "text": "<message>", "chatId": "<id>" }
```

Messages then appear live in the console. A user message of the form
`/goal <target> :: <definition of done>` starts a Goal Mode loop from Telegram.

---

## Architecture

```
app/api/chat      → streams Hermes chat (SSE-ish text stream)
app/api/goal      → start / stop autonomous loops
app/api/events    → SSE bus: loop progress, artifacts, telegram → UI
app/api/telegram  → inbound bridge from your bot
app/api/state     → initial hydration

lib/hermes.ts     → OpenAI-compatible client (one file)
lib/loop.ts       → Goal Mode: worker → critic → loop-until-done
lib/agents.ts     → agent profiles + the Critic
lib/tools.ts      → file + shell tools (workspace-confined)
lib/bus.ts        → in-memory pub/sub for SSE
lib/store.ts      → in-memory runs / artifacts / messages
```

## Notes / known ceilings

- State is **in-memory** — a restart clears runs and artifacts. Add SQLite/Redis if you need history.
- The bus is **single-process** — fine for one VPS. Use Redis pub/sub for multiple instances.
- `run_shell` is workspace-confined with a 60s timeout and an off-by-default flag — **not** a hardened sandbox. Run on a trusted VPS; containerize for untrusted goals.
- External MCP servers aren't wired yet; the built-in file/shell tools cover "read/write files + run commands." Add `@modelcontextprotocol/sdk` and a client in `lib/` to connect external MCP servers.
