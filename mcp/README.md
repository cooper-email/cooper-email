# Cooper Email MCP

Cooper Email runs a hosted, remote MCP server. There is nothing to install or run locally.

- Endpoint: `https://cooperemail.com/mcp`
- Transport: Streamable HTTP
- Auth: OAuth 2.1 + PKCE (Claude and ChatGPT custom connectors), or `Authorization: Bearer coop_live_…` (Cursor, Claude Code, scripts)
- OAuth discovery: `https://cooperemail.com/.well-known/oauth-protected-resource` and `https://cooperemail.com/.well-known/oauth-authorization-server`
- Registry entry: [`../server.json`](../server.json) (`com.cooperemail/cooper-email` in the official MCP Registry)
- Docs: https://cooperemail.com/docs/mcp

`cooper_onboard` works without a key: it creates an account, an inbox, and returns an API key. The other tools need the key or an OAuth token.

## Client config files

Replace `coop_live_YOUR_KEY` with your key. If your client supports OAuth for remote MCP servers, you can drop the `headers` block and sign in instead.

| Client | File | Where it goes |
| --- | --- | --- |
| Claude Desktop | [`clients/claude-desktop.json`](clients/claude-desktop.json) | macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Code | [`clients/claude-code.json`](clients/claude-code.json) | `.mcp.json`, or run `claude mcp add --transport http cooper-email https://cooperemail.com/mcp` |
| Cursor | [`clients/cursor.mcp.json`](clients/cursor.mcp.json) | `~/.cursor/mcp.json` or `.cursor/mcp.json` |
| Windsurf | [`clients/windsurf.json`](clients/windsurf.json) | `~/.codeium/windsurf/mcp_config.json` |
| VS Code | [`clients/vscode.mcp.json`](clients/vscode.mcp.json) | `.vscode/mcp.json` |
| Codex CLI | [`clients/codex.config.toml`](clients/codex.config.toml) | `~/.codex/config.toml` |
| Goose | [`clients/goose.config.yaml`](clients/goose.config.yaml) | `~/.config/goose/config.yaml` |

## Tools

| Tool | What it does |
| --- | --- |
| `cooper_onboard` | Create an account + inbox and return an API key (no auth) |
| `cooper_create_inbox`, `cooper_list_inboxes` | Manage inboxes |
| `cooper_send_message` | Send mail (text, HTML, attachments, idempotent `client_id`) |
| `cooper_list_messages`, `cooper_get_message`, `cooper_search` | Read and search mail |
| `cooper_register_webhook` | Register a signed webhook |
| `cooper_add_owner`, `cooper_list_owners` | Add the human who supervises the inbox (they confirm by email) |
| `cooper_notify_owner` | Email the owner a `progress`, `needs_input`, `done`, or `error` update |
| `cooper_get_tasks`, `cooper_reply_task` | Read owner replies as tasks (long-poll) and answer in-thread |
| `cooper_inject_inbound` | Inject a test inbound message |
| `cooper_billing_status`, `cooper_upgrade_link` | Plan/usage and an upgrade checkout link |

The live list is whatever `tools/list` on the endpoint returns.
