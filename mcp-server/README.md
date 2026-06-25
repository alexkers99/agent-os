# Vault MCP Server — Claude Desktop Setup

## What this does
Connects Claude Desktop directly to your agent-os Obsidian vault.
Claude can list, read, search, and write notes in every conversation.

## Setup (Windows)

1. Open Claude Desktop config:
   `%APPDATA%\Claude\claude_desktop_config.json`

2. Add this configuration:

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

3. Restart Claude Desktop.
4. In any conversation, Claude will now have access to vault tools.
   Try: "List my vault notes" or "Read somnia.md"

## Tools

| Tool | Params | Description |
|------|--------|-------------|
| `list_notes` | — | List all `.md` notes in the vault |
| `read_note` | `filename` | Read a note's full markdown |
| `search_notes` | `query` | Case-insensitive keyword search → `{ filename, excerpt }[]` |
| `write_note` | `filename`, `content` | Create or overwrite a note |

## Notes
- Transport: stdio (JSON-RPC 2.0). Claude Desktop spawns the process; here it spawns `ssh`, which runs the server on the VPS so it operates on the live synced vault.
- The server is pure Node.js stdlib — no dependencies, no `npm install`.
- Vault path resolves to `../workspace/vault` relative to the script.
- For the SSH transport to work, the public key of `vault_deploy` must be in the VPS user's `~/.ssh/authorized_keys` (separate from its GitHub deploy-key role), and the VPS must accept SSH from your machine on port 22.
