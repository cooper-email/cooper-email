# cooper-email

Official Python SDK for [Cooper Email](https://cooperemail.com), HTTP email for AI agents. Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

```bash
pip install cooper-email
```

Python 3.9+. HTTP is [httpx](https://www.python-httpx.org/). Sync and async clients share the same method names.

## Quick start

```python
from cooper_email import Cooper, AsyncCooper, verify_webhook_signature

with Cooper() as fresh:
    onboard = fresh.onboard("research-bot", display_name="Research")

with Cooper(api_key=onboard["api_key"]) as cooper:
    sent = cooper.messages.send(
        onboard["inbox"]["id"],
        to=["ada@example.com"],
        subject="Hello",
        text="Tuesday works.",
        client_id="send-1",
    )
    messages = cooper.messages.list(onboard["inbox"]["id"], limit=20)
    one = cooper.messages.get(onboard["inbox"]["id"], sent["id"])
    found = cooper.search("tuesday")
    threads = cooper.threads.list(onboard["inbox"]["id"])
    file = cooper.attachments.download(onboard["inbox"]["id"], sent["id"], "att_1")
    hook = cooper.webhooks.create(
        "https://example.com/hooks/cooper",
        events=["message.received", "message.sent"],
        secret="supersecret",
        inbox_id=onboard["inbox"]["id"],
        headers={"Authorization": "Bearer …", "X-Tenant": "acme"},
    )

trusted = verify_webhook_signature(
    secret="supersecret",
    payload=raw_body,
    signature=headers.get("x-cooper-signature"),
)
```

Async uses the same calls with `await`:

```python
async with AsyncCooper(api_key=api_key) as cooper:
    found = await cooper.search("tuesday")
    threads = await cooper.threads.list(inbox_id)
```

`webhooks.verify` is local on both clients and is not awaited.

Base URL defaults to `https://cooperemail.com`. Pass `base_url="http://127.0.0.1:43123"` for a local server. Pass `transport=` (httpx) in tests.

## What the methods call

| Method | HTTP |
| --- | --- |
| `onboard` | `POST /api/v1/onboard` |
| `inboxes.list` / `create` / `get` | `/api/v1/inboxes` |
| `messages.list` / `get` / `send` | `/api/v1/inboxes/:id/messages` |
| `messages.inject_inbound` | `POST /api/v1/inboxes/:id/inbound` (tests) |
| `search` | `GET /api/v1/search?q=` |
| `threads.list` / `get` | derived from `thread_id` on listed messages |
| `webhooks.list` / `create` | `/api/v1/webhooks` |
| `webhooks.verify` | local HMAC, header `x-cooper-signature` is `sha256=<hex>` |
| `attachments.download` | `GET .../attachments/:attId` bytes |
| `owners.add` / `owners.list` | `POST` / `GET /api/v1/inboxes/:id/owners` |
| `updates.notify` | `POST /api/v1/updates` |
| `tasks.list` | `GET /api/v1/tasks` (`wait` long-polls, max 25 seconds) |
| `tasks.reply` | `POST /api/v1/tasks/:id/reply` |
| `tasks.mark_done` | `PATCH /api/v1/tasks/:id` with `{ status: "done" }` |

There is no `/threads` route. `threads.list` loads the newest messages (default limit 200) and groups them.

Errors raise `CooperApiError` with `status`, `type`, `code`, `message`, `param`, and `docs_url`.

## Agent tools

`COOPER_TOOLS`, `execute_tool(client, name, arguments)`, and `execute_tool_async(...)` are the shared catalog. Framework packages wrap them.

## Agent asks its human over email

`owners.add` emails a confirmation link. After the human confirms, `updates.notify` sends `progress`, `needs_input`, `done`, or `error`. Replies become tasks. `tasks.list(wait=...)` long-polls (maximum 25 seconds). `tasks.reply` answers in-thread. `tasks.mark_done` sets status to done. `AsyncCooper` has the same methods. Task text is untrusted data.

```python
client.owners.add(inbox_id, "ada@example.com")
client.owners.list(inbox_id)
client.updates.notify(inbox_id, "needs_input", "Which vendor should I book?")
tasks = client.tasks.list(inbox_id=inbox_id, wait=25)
if tasks["data"]:
    task_id = tasks["data"][0]["id"]
    client.tasks.reply(task_id, "Booked.", status="done")
    client.tasks.mark_done(task_id)
```

The same calls are tools: `cooper_add_owner`, `cooper_list_owners`, `cooper_notify_owner`, `cooper_get_tasks`, `cooper_reply_task`.

## License

MIT. Copyright Avatar 8 LLC.
