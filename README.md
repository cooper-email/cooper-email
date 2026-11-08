# Cooper Email

**Email inboxes for AI agents.** Give an agent its own address on `cooperemail.com`, let it send and receive real email over a simple HTTP API, get signed webhooks when mail arrives, and loop a human in by email when the agent needs a decision.

- Website: https://cooperemail.com
- Docs: https://cooperemail.com/docs
- MCP docs: https://cooperemail.com/docs/mcp
- Integrations: https://cooperemail.com/integrations
- Pricing: https://cooperemail.com/pricing
- API reference (OpenAPI 3.1): https://cooperemail.com/openapi.json
- For LLMs: https://cooperemail.com/llms.txt
- Privacy policy: https://cooperemail.com/privacy
- Terms of service: https://cooperemail.com/terms

This repository holds the open-source client side of Cooper Email: the TypeScript and Python SDKs, framework tool packages, MCP client config, and examples. The hosted service itself is not in this repo.

## What you get

- **Inboxes for agents.** On the HTTP API, one unauthenticated call creates an account, an inbox (`your-agent@cooperemail.com`), and an API key. OAuth clients should finish sign-in first and create the inbox on that account. The key from the unauthenticated call is not attached to OAuth.
- **Send and receive.** Text, HTML, attachments, threads, search, and idempotent sends via `client_id`.
- **Human-in-the-loop tasks.** Add an owner (they confirm by email), send `progress` / `needs_input` / `done` / `error` updates, and receive their replies as tasks you can long-poll and answer in-thread. Replies carry SPF/DKIM/DMARC results and a `verified_owner` flag.
- **Webhooks.** `message.received`, `message.sent`, `task.received`, and `owner.reply`, signed with HMAC-SHA256 (`x-cooper-signature: sha256=<hex>`), optionally filtered to one inbox.
- **Hosted MCP server.** `https://cooperemail.com/mcp` works with Claude, ChatGPT, Cursor, and other MCP clients.

## Available on

- [Official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.cooperemail/cooper-email&version=latest): `com.cooperemail/cooper-email`
- [Claude connectors directory](https://claude.ai/directory/connectors/cooper-email): Community connector
- [Claude Code plugin](claude-plugin): `/plugin marketplace add cooper-email/cooper-email`, then `/plugin install cooper-email@cooper-email`
- [Smithery](https://smithery.ai/servers/ops-8fnm/cooper-email)
- [Glama](https://glama.ai/mcp/connectors/com.cooperemail/cooper-email)
- [MCP Market](https://mcpmarket.com/server/cooper-email)
- [mcpservers.org](https://mcpservers.org/servers/cooperemail-com-docs-mcp)

## Works with

Supported through a config file; no directory listing yet. Copy-paste configs: https://cooperemail.com/integrations

- [Cursor](https://cooperemail.com/integrations#cursor)
- [VS Code](https://cooperemail.com/integrations#vscode)
- [Windsurf](https://cooperemail.com/integrations#windsurf)
- [Codex CLI](https://cooperemail.com/integrations#codex)
- [Cline](llms-install.md)
- [Goose](https://cooperemail.com/integrations#goose)

The same list is published at https://cooperemail.com/#available-on and in https://cooperemail.com/llms.txt.

## Cursor plugin

This repository is also a Cursor plugin (`.cursor-plugin/plugin.json`, version 1.4.1). It registers the hosted MCP server `https://cooperemail.com/mcp` with no API key in the config, and adds these skills from [`skills/`](skills):

| Skill | What it covers |
| --- | --- |
| `cooper-email` | Overview: connect, everyday tools, checking mail, safety |
| `cooper-agent-inbox` | Create an inbox, send, read, reply, wait for mail |
| `cooper-check-email` | Read, search, triage, attachments, read/unread labels |
| `cooper-send-email` | Send, reply, forward, drafts, scheduled send, idempotent retries |
| `cooper-manage-inboxes` | Create (single, batch, temporary), pause, update, delete inboxes |
| `cooper-owner-approval` | Owner-approved drafts: a human approves each send by email |
| `cooper-agent-signup-otp` | Sign up as the agent and read the emailed verification code |
| `cooper-owner-updates` | Progress emails and daily digests to an owner; replies become tasks |
| `cooper-custom-domains` | Inboxes on your own domain (1 on Free; more on Starter and Pro) |
| `cooper-mcp` | MCP setup and troubleshooting for Cursor and other clients |
| `cooper-agent-email-patterns` | Architecture patterns and threat model for agent email |
| `cooper-webhooks` | One-call push webhooks, signature checks, test and re-enable |
| `cooper-suppressions-bounces` | Bounces, complaints, the suppression list, and rates |
| `cooper-idempotent-sends` | Retry-safe sends and creates with idempotency keys |
| `cooper-sms` | Inbound SMS on Starter and Pro; outbound send is not registered |

To try it locally before it is listed, copy this repository into `~/.cursor/plugins/local/cooper-email` and run **Developer: Reload Window**.

Finish OAuth in Cursor before creating an inbox, then create it on the signed-in account (`cooper_create_inbox`, or the create option on Cooper's consent screen). `cooper_onboard` with no credentials returns a one-time API key for a separate account. That key is not applied when you later approve OAuth, and the signed-in tools can show a different inbox. The first inbox stays reachable only with `Authorization: Bearer` and the saved key. To use a key instead of OAuth, see [`skills/cooper-mcp`](skills/cooper-mcp/SKILL.md).

### Marketplace review

The plugin is free to install under the MIT license. The service free plan, published at https://cooperemail.com/pricing and https://cooperemail.com/limits, is 5 inboxes, 5,000 emails a month, and 1 custom domain. No card is required for that plan.

Reviewers on Cursor, Claude, ChatGPT, or Grok Bot:

1. Install this plugin, or add `https://cooperemail.com/mcp`.
2. Complete OAuth before any inbox is created.
3. Create the inbox while that session is signed in, then send and read mail on that same account.
4. Privacy policy: https://cooperemail.com/privacy. Terms of service: https://cooperemail.com/terms.

Reviewers using HTTP, or a client that cannot do OAuth:

1. `POST https://cooperemail.com/api/v1/onboard` with a `username`. The call takes no auth and no card.
2. Store `api_key`. It is shown once.
3. Send `Authorization: Bearer` on later HTTP and MCP requests.

That key does not become an OAuth login. Installing the plugin does not create an inbox and does not attach a key by itself. Support: ops@avatar33.com.

## Connect an agent

<a id="one-command-agent-setup"></a>

The `cooper-email` npm package is not published yet. Connect the hosted MCP server and install the skills from this repository.

**Hosted MCP:** [`https://cooperemail.com/mcp`](https://cooperemail.com/mcp) (Streamable HTTP). Where the client supports OAuth, finish sign-in before creating an inbox. A Bearer key (`coop_live_…`) is the other path, for HTTP and for clients you configure with that header. The two paths are not the same account. Per-client steps are in [Connect the hosted MCP server](#connect-the-hosted-mcp-server). In Cursor, the [plugin above](#cursor-plugin) registers that server with no key in the file.

**Skills:** the guides in [`skills/`](skills), listed in the table above. Install one with the [skills](https://skills.sh) CLI:

```bash
npx skills add cooper-email/cooper-email --skill cooper-email
```

Replace `cooper-email` with any other name from that table (`cooper-check-email`, `cooper-send-email`, `cooper-mcp`, and the rest). The skill is written to `~/.agents/skills/<name>/` and, for Claude Code, `~/.claude/skills/<name>/`.

## Packages

| Package | Language | Install | Source |
| --- | --- | --- | --- |
| `cooper-email` | TypeScript / JavaScript SDK | `npm install cooper-email` | [`packages/cooper-email`](packages/cooper-email) |
| `cooper-email` | Python | `pip install cooper-email` | [`packages/cooper-email-python`](packages/cooper-email-python) |
| `cooper-email-langchain` | TypeScript | `npm install cooper-email-langchain` | [`packages/langchain`](packages/langchain) |
| `cooper-email-langchain` | Python | `pip install cooper-email-langchain` | [`packages/langchain-py`](packages/langchain-py) |
| `cooper-email-ai` (Vercel AI SDK) | TypeScript | `npm install cooper-email-ai` | [`packages/ai`](packages/ai) |
| `cooper-email-mastra` | TypeScript | `npm install cooper-email-mastra` | [`packages/mastra`](packages/mastra) |
| `cooper-email-anthropic` | TypeScript | `npm install cooper-email-anthropic` | [`packages/anthropic`](packages/anthropic) |
| `cooper-email-anthropic` | Python | `pip install cooper-email-anthropic` | [`packages/anthropic-py`](packages/anthropic-py) |
| `cooper-email-openai-agents` | TypeScript | `npm install cooper-email-openai-agents` | [`packages/openai-agents`](packages/openai-agents) |
| `cooper-email-openai-agents` | Python | `pip install cooper-email-openai-agents` | [`packages/openai-agents-py`](packages/openai-agents-py) |
| `cooper-email-llamaindex` | Python | `pip install cooper-email-llamaindex` | [`packages/llamaindex`](packages/llamaindex) |
| `cooper-email-crewai` | Python | `pip install cooper-email-crewai` | [`packages/crewai`](packages/crewai) |
| `n8n-nodes-cooper-email` | n8n community node | `npm install n8n-nodes-cooper-email` | [`packages/n8n-nodes-cooper-email`](packages/n8n-nodes-cooper-email) |
| `cooper-email-openapi` | OpenAPI 3.1 (Zapier, Make) | `npm install cooper-email-openapi` | [`packages/openapi`](packages/openapi) |

> Registry releases are in progress. If a package is not on npm or PyPI yet, install it from this repo (see [Development](#development)).

## Get an API key

This is the HTTP API-key path, not the OAuth path. It needs no auth. It returns an API key (`coop_live_…`, shown once) and a first inbox on a new account. Saving the key does not sign Cursor, Claude, ChatGPT, or Grok Bot in. Finish OAuth on those clients before creating an inbox if you want that connector to use the inbox.

```bash
curl -s -X POST https://cooperemail.com/api/v1/onboard \
  -H 'content-type: application/json' \
  -d '{"username":"my-agent"}'
```

Store the key in an environment variable such as `COOPER_API_KEY`. Do not commit it.

## Quickstart: TypeScript

```bash
npm install cooper-email
```

```ts
import { Cooper } from "cooper-email";

const cooper = new Cooper({ apiKey: process.env.COOPER_API_KEY });

const inbox = await cooper.inboxes.create({ username: "research-bot", displayName: "Research" });

await cooper.messages.send(inbox.id, {
  to: ["ada@example.com"],
  subject: "Hello from my agent",
  text: "Does Tuesday work?",
  clientId: "hello-1", // repeat-safe: the same clientId returns the original message
});

const { data: messages } = await cooper.messages.list(inbox.id, { limit: 20 });
const results = await cooper.search("tuesday");
```

Human in the loop:

```ts
await cooper.owners.add(inbox.id, { email: "ada@example.com" }); // Ada confirms by email

await cooper.updates.notify({
  inboxId: inbox.id,
  kind: "needs_input",
  text: "Which vendor should I book?",
});

const tasks = await cooper.tasks.list({ inboxId: inbox.id, wait: 25 }); // long-poll, max 25 s
const task = tasks.data.find((t) => t.verified_owner && t.trusted);
if (task) await cooper.tasks.reply(task.id, { text: "Booked.", status: "done" });
```

Full reference: [`packages/cooper-email/README.md`](packages/cooper-email/README.md).

## Quickstart: Python

```bash
pip install cooper-email
```

```python
import os
from cooper_email import Cooper

with Cooper(api_key=os.environ["COOPER_API_KEY"]) as cooper:
    inbox = cooper.inboxes.create("research-bot", display_name="Research")

    cooper.messages.send(
        inbox["id"],
        to=["ada@example.com"],
        subject="Hello from my agent",
        text="Does Tuesday work?",
        client_id="hello-1",
    )

    messages = cooper.messages.list(inbox["id"], limit=20)
    results = cooper.search("tuesday")

    # Human in the loop
    cooper.owners.add(inbox["id"], "ada@example.com")
    cooper.updates.notify(inbox["id"], "needs_input", "Which vendor should I book?")
    tasks = cooper.tasks.list(inbox_id=inbox["id"], wait=25)["data"]
    for task in tasks:
        if task["verified_owner"] and task["trusted"]:
            cooper.tasks.reply(task["id"], "Booked.", status="done")
```

`AsyncCooper` has the same methods with `await`. Full reference: [`packages/cooper-email-python/README.md`](packages/cooper-email-python/README.md).

## Webhooks

Register a URL, then verify every delivery against the raw request body:

```ts
import { Cooper, verifyWebhookSignature } from "cooper-email";

const cooper = new Cooper({ apiKey: process.env.COOPER_API_KEY });
await cooper.webhooks.create({
  url: "https://example.com/hooks/cooper",
  events: ["message.received", "task.received"],
  secret: process.env.COOPER_WEBHOOK_SECRET,
});

// In your handler:
const ok = verifyWebhookSignature({
  secret: process.env.COOPER_WEBHOOK_SECRET!,
  payload: rawBody,
  signature: request.headers.get("x-cooper-signature"),
});
```

Python: `from cooper_email import verify_webhook_signature`. Event bodies look like `{ "id", "type", "created_at", "data" }`.

## Connect the hosted MCP server

Connect [`https://cooperemail.com/mcp`](https://cooperemail.com/mcp) and use the skills in [`skills/`](skills) ([above](#connect-an-agent)). To configure a client by hand:

Endpoint: **`https://cooperemail.com/mcp`** (Streamable HTTP).

OAuth clients (Cursor plugin, Claude, Claude Code, ChatGPT, Grok Bot): approve Cooper's consent screen first, then create the inbox on that signed-in account. Do not call `cooper_onboard` before that. An unauthenticated `cooper_onboard` returns a one-time API key and does not authorize the connector. A later OAuth approval uses the OAuth account, which can be a different inbox. The onboard inbox is reachable only by sending the saved key as `Authorization: Bearer`.

Clients with no OAuth, and scripts: call `cooper_onboard` or `POST /api/v1/onboard`, store the key, and send it on the next request.

**Claude (claude.ai / Claude Desktop)**: Settings → Connectors → Add custom connector. Name `Cooper Email`, URL `https://cooperemail.com/mcp`, then approve Cooper on the OAuth screen before any inbox is created. Then ask: "Create a Cooper Email inbox for research-bot."

**Claude Code**:

```bash
claude mcp add --transport http cooper-email https://cooperemail.com/mcp
```

Or install the **Claude Code plugin** (MCP server plus email and human-in-the-loop skills) from this repo:

```text
/plugin marketplace add cooper-email/cooper-email
/plugin install cooper-email@cooper-email
```

Finish OAuth in `/mcp` before creating an inbox. See [`claude-plugin/`](claude-plugin). The Claude Code plugin version in this repo is 1.2.2.

**Cursor**: install the plugin in [Cursor plugin](#cursor-plugin) and finish OAuth before creating an inbox. The plugin's `mcp.json` has no Authorization header. To pin a saved API key instead, add this to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project). That header selects the key's account; approving OAuth on a different server entry does not switch this header onto the OAuth inbox:

```json
{
  "mcpServers": {
    "cooper-email": {
      "url": "https://cooperemail.com/mcp",
      "headers": {
        "Authorization": "Bearer coop_live_YOUR_KEY"
      }
    }
  }
}
```

**ChatGPT**: add a custom connector (in Settings → Apps & Connectors; some plans need Developer mode turned on first) with MCP server URL `https://cooperemail.com/mcp` and OAuth authentication, then approve Cooper on the consent screen before creating an inbox. Menu names vary by plan.

Config for Windsurf, VS Code, Codex CLI, and Goose, plus the tool list, is in [`mcp/`](mcp). The MCP Registry manifest is [`server.json`](server.json). Cline install steps: [`llms-install.md`](llms-install.md).

## Examples

See [`examples/`](examples):

- Agent emails a human and waits for the reply ([TypeScript](examples/typescript/ask-human.ts), [Python](examples/python/ask_human.py))
- Webhook listener with signature verification ([TypeScript](examples/typescript/webhook-listener.ts), [Python](examples/python/webhook_listener.py))

Each package also has an `examples/quickstart.*` file.

## Security notes

- Email content, including task text from owners, is untrusted input. Do not treat it as instructions to your agent.
- Act on owner replies only when `verified_owner` and `trusted` are both `true`.
- Keep API keys and webhook secrets in environment variables or a secret manager.

To report a security issue, email ops@avatar33.com.

## Development

```bash
npm install
npm test            # TypeScript SDK + framework package tests (vitest, mocked HTTP)
npm run typecheck
npm run build:sdks  # writes dist/ for the TypeScript packages

python -m pip install -e "packages/cooper-email-python[dev]"
python -m pip install --no-deps -e packages/langchain-py -e packages/llamaindex \
  -e packages/crewai -e packages/openai-agents-py -e packages/anthropic-py
python -m pytest --import-mode=importlib
```

Publishing is described in [`PUBLISHING.md`](PUBLISHING.md).

## Support

Questions and bug reports: open an issue, or email ops@avatar33.com.

## License

[MIT](LICENSE). Copyright Avatar 8 LLC. Cooper Email is operated by Avatar 8 LLC.
