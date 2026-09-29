# Cooper Email

**Email inboxes for AI agents.** Give an agent its own address on `cooperemail.com`, let it send and receive real email over a simple HTTP API, get signed webhooks when mail arrives, and loop a human in by email when the agent needs a decision.

- Website: https://cooperemail.com
- Docs: https://cooperemail.com/docs
- MCP docs: https://cooperemail.com/docs/mcp
- Integrations: https://cooperemail.com/integrations
- Pricing: https://cooperemail.com/pricing
- API reference (OpenAPI 3.1): https://cooperemail.com/openapi.json
- For LLMs: https://cooperemail.com/llms.txt

This repository holds the open-source client side of Cooper Email: the TypeScript and Python SDKs, framework tool packages, MCP client config, and examples. The hosted service itself is not in this repo.

## What you get

- **Inboxes for agents.** One API call creates an account, an inbox (`your-agent@cooperemail.com`), and an API key. No dashboard needed.
- **Send and receive.** Text, HTML, attachments, threads, search, and idempotent sends via `client_id`.
- **Human-in-the-loop tasks.** Add an owner (they confirm by email), send `progress` / `needs_input` / `done` / `error` updates, and receive their replies as tasks you can long-poll and answer in-thread. Replies carry SPF/DKIM/DMARC results and a `verified_owner` flag.
- **Webhooks.** `message.received`, `message.sent`, `task.received`, and `owner.reply`, signed with HMAC-SHA256 (`x-cooper-signature: sha256=<hex>`), optionally filtered to one inbox.
- **Hosted MCP server.** `https://cooperemail.com/mcp` works with Claude, ChatGPT, Cursor, and other MCP clients.

## Packages

| Package | Language | Install | Source |
| --- | --- | --- | --- |
| `cooper-email` | TypeScript / JavaScript | `npm install cooper-email` | [`packages/cooper-email`](packages/cooper-email) |
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

Onboarding needs no auth. It returns an API key (`coop_live_…`, shown once) and your first inbox:

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

Endpoint: **`https://cooperemail.com/mcp`** (Streamable HTTP). Claude and ChatGPT connectors sign in with OAuth. Cursor, Claude Code, and scripts can send `Authorization: Bearer coop_live_…`. The `cooper_onboard` tool works before you have a key.

**Claude (claude.ai / Claude Desktop)**: Settings → Connectors → Add custom connector. Name `Cooper Email`, URL `https://cooperemail.com/mcp`, then approve Cooper on the OAuth screen. Then ask: "Create a Cooper Email inbox for research-bot."

**Claude Code**:

```bash
claude mcp add --transport http cooper-email https://cooperemail.com/mcp
```

**Cursor**: add to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

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

**ChatGPT**: add a custom connector (in Settings → Apps & Connectors; some plans need Developer mode turned on first) with MCP server URL `https://cooperemail.com/mcp` and OAuth authentication, then approve Cooper on the consent screen. Menu names vary by plan.

Config for Windsurf, VS Code, Codex CLI, and Goose, plus the tool list, is in [`mcp/`](mcp). The MCP Registry manifest is [`server.json`](server.json).

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
