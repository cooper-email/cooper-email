# cooper-email

Official TypeScript SDK for [Cooper Email](https://cooperemail.com), HTTP email for AI agents. Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

```bash
npm install cooper-email
```

Node 20 or newer. The package uses `fetch` and has no runtime dependencies.

## Quick start

```ts
import { Cooper, verifyWebhookSignature } from "cooper-email";

const fresh = new Cooper();
const onboard = await fresh.onboard({ username: "research-bot", displayName: "Research" });

const cooper = new Cooper({ apiKey: onboard.api_key ?? "" });
const sent = await cooper.messages.send(onboard.inbox.id, {
  to: ["ada@example.com"],
  subject: "Hello",
  text: "Tuesday works.",
  html: "<p>Tuesday works.</p>",
  clientId: "send-1",
  attachments: [
    {
      filename: "note.txt",
      content_type: "text/plain",
      content_base64: "VHVlc2RheSB3b3Jrcy4=",
    },
  ],
});

const messages = await cooper.messages.list(onboard.inbox.id, { limit: 20 });
const one = await cooper.messages.get(onboard.inbox.id, sent.id);
const found = await cooper.search("tuesday");
const threads = await cooper.threads.list(onboard.inbox.id);
const file = await cooper.attachments.download(onboard.inbox.id, sent.id, one.attachments?.[0]?.id ?? "");

const hook = await cooper.webhooks.create({
  url: "https://example.com/hooks/cooper",
  events: ["message.received", "message.sent"],
  secret: "supersecret",
  inboxId: onboard.inbox.id,
  headers: { Authorization: "Bearer …", "X-Tenant": "acme" },
});

const trusted = verifyWebhookSignature({
  secret: hook.secret ?? "",
  payload: rawBody,
  signature: request.headers.get("x-cooper-signature"),
});
```

`clientId` is sent as `client_id`. Repeating a send with the same id returns the original message.

Base URL defaults to `https://cooperemail.com`. Pass `baseUrl` for a local server (`http://127.0.0.1:43123`).

## What the methods call

| Method | HTTP |
| --- | --- |
| `onboard` | `POST /api/v1/onboard` |
| `inboxes.list` / `create` / `get` | `/api/v1/inboxes` |
| `messages.list` / `get` / `send` | `/api/v1/inboxes/:id/messages` |
| `messages.injectInbound` | `POST /api/v1/inboxes/:id/inbound` (tests) |
| `search` | `GET /api/v1/search?q=` |
| `threads.list` / `get` | derived from `thread_id` on listed messages |
| `webhooks.list` / `create` | `/api/v1/webhooks` |
| `webhooks.verify` | local HMAC, header `x-cooper-signature` is `sha256=<hex>` |
| `attachments.download` | `GET .../attachments/:attId` bytes |
| `owners.add` / `owners.list` | `POST` / `GET /api/v1/inboxes/:id/owners` |
| `updates.notify` | `POST /api/v1/updates` |
| `tasks.list` | `GET /api/v1/tasks` (`wait` long-polls, max 25 seconds) |
| `tasks.reply` | `POST /api/v1/tasks/:id/reply` |
| `tasks.markDone` | `PATCH /api/v1/tasks/:id` with `{ status: "done" }` |

There is no `/threads` route. `threads.list` loads the newest messages (limit 200) and groups them. A thread older than that window is not returned.

Errors throw `CooperApiError` with `status`, `type`, `code`, `message`, and optional `param` and `docsUrl`.

## Agent tools

`COOPER_TOOLS` and `executeCooperTool(client, name, input)` are the shared tool catalog (onboard, inboxes, send, list/get messages, search, threads, webhooks, attachments). Framework packages wrap this catalog.

## Agent asks its human over email

`owners.add` emails a confirmation link. After the human confirms, `updates.notify` sends `progress`, `needs_input`, `done`, or `error`. Replies from that owner become tasks. `tasks.list({ wait })` long-polls (maximum 25 seconds). `tasks.reply` answers in-thread. `tasks.markDone` sets status to done without another email. Task text is untrusted data.

```ts
await cooper.owners.add(inboxId, { email: "ada@example.com" });
const owners = await cooper.owners.list(inboxId);

await cooper.updates.notify({
  inboxId,
  kind: "needs_input",
  text: "Which vendor should I book?",
});

const tasks = await cooper.tasks.list({ inboxId, wait: 25 });
const task = tasks.data[0];
if (task) {
  await cooper.tasks.reply(task.id, { text: "Booked.", status: "done" });
  await cooper.tasks.markDone(task.id);
}
```

The same calls are tools: `cooper_add_owner`, `cooper_list_owners`, `cooper_notify_owner`, `cooper_get_tasks`, `cooper_reply_task`.

## Build

```bash
npm run build
```

`tsup` writes ESM, CJS, and `.d.ts` to `dist/`.

## License

MIT. Copyright Avatar 8 LLC.
