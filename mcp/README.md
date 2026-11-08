# Cooper Email MCP

Cooper Email runs a hosted, remote MCP server. There is nothing to install or run locally.

- Endpoint: `https://cooperemail.com/mcp`
- Transport: Streamable HTTP
- Auth: OAuth 2.1 + PKCE (Cursor plugin, Claude, ChatGPT, Grok Bot), or `Authorization: Bearer coop_live_…` (scripts and clients with no OAuth)
- OAuth discovery: `https://cooperemail.com/.well-known/oauth-protected-resource` and `https://cooperemail.com/.well-known/oauth-authorization-server`
- Registry entry: [`../server.json`](../server.json) (`com.cooperemail/cooper-email` in the official MCP Registry)
- Docs: https://cooperemail.com/docs/mcp
- Privacy: https://cooperemail.com/privacy
- Terms: https://cooperemail.com/terms

Finish OAuth before creating an inbox when the client supports it. `cooper_onboard` with no credentials creates an account, an inbox, and a one-time API key. That key is not attached to a later OAuth login. Other tools need either that saved Bearer key or an OAuth token, and those two credentials can be different accounts. A 401 is not fixed by calling `cooper_onboard`.

## Client config files

Replace `coop_live_YOUR_KEY` with a key you already saved. If the client supports OAuth, leave the header out and finish sign-in before creating an inbox. Dropping the header does not move the key's inbox onto the OAuth account.

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
| `cooper_onboard` | Unauthenticated: create a separate account, inbox, and one-time API key. Does not sign an OAuth connector in |
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
