# Vault MCP Server — Claude Desktop Setup

## What this does
Connects Claude Desktop directly to your agent-os Obsidian vault.
Claude can list, read, search, and write notes in every conversation.

Pure Node.js stdlib — no dependencies, no `npm install`. JSON-RPC 2.0 over stdio.

The vault path is resolved in this order: `VAULT_DIR` env var → first CLI arg → default `../workspace/vault`.

---

## Option A — Local (recommended) ✅ tested

Your Obsidian vault is already synced to this PC at `C:\Users\losti\obsidian-vault` (via the
Obsidian Git plugin). So just run the server **locally** against that clone — no SSH, no keys,
no open ports.

1. Open `%APPDATA%\Claude\claude_desktop_config.json`
2. Add:

```json
{
  "mcpServers": {
    "vault": {
      "command": "node",
      "args": [
        "C:\\Users\\losti\\Agent os\\mcp-server\\vault-mcp.js",
        "C:\\Users\\losti\\obsidian-vault"
      ]
    }
  }
}
```

3. Restart Claude Desktop → try "List my vault notes".

Writes go to the local clone; Obsidian Git pushes them, and `vault-sync` on the VPS pulls them —
so changes propagate back to agent-os within a couple of minutes.

---

## Option B — SSH to the VPS (advanced)

Runs the server **on the VPS** so it reads the live vault directly. Requires more setup:

```json
{
  "mcpServers": {
    "vault": {
      "command": "ssh",
      "args": [
        "-i", "C:\\Users\\losti\\.ssh\\vault_deploy",
        "-o", "StrictHostKeyChecking=no",
        "u4s@187.124.56.127",
        "node /data/u4s/agent-os/mcp-server/vault-mcp.js"
      ]
    }
  }
}
```

Prerequisites (none are met yet):
1. **A private key on this PC** at `C:\Users\losti\.ssh\vault_deploy`. There is currently **no
   `~/.ssh` on this machine** — the existing `vault_deploy` lives on the *VPS*. Generate a PC key:
   `ssh-keygen -t ed25519 -f $HOME\.ssh\vault_deploy -N '""'`.
2. **That key's `.pub` added to the VPS** `~/.ssh/authorized_keys` for `u4s` (the VPS's own
   `vault_deploy` is a GitHub deploy key — different authorization).
3. **Port 22 reachable** from this PC to `187.124.56.127`. Verify:
   `ssh -i $HOME\.ssh\vault_deploy u4s@187.124.56.127 "node -v"`.

Use Option A unless you specifically need the server to run on the VPS.

---

## Tools

| Tool | Params | Description |
|------|--------|-------------|
| `list_notes` | — | List all `.md` notes in the vault |
| `read_note` | `filename` | Read a note's full markdown |
| `search_notes` | `query` | Case-insensitive keyword search → `{ filename, excerpt }[]` |
| `write_note` | `filename`, `content` | Create or overwrite a note |
