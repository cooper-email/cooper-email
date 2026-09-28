# n8n-nodes-cooper-email

n8n community node for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

In n8n: Settings → Community nodes → Install `n8n-nodes-cooper-email`.

Or:

```bash
npm install n8n-nodes-cooper-email
```

## Credential

- API key: the `coop_live_…` key from onboard. Leave it empty for the Onboard operation.
- Base URL: `https://cooperemail.com`

## Operations

Onboard, create inbox, list inboxes, send, list messages, get message, search, register webhook, download attachment, add owner, list owners, notify owner, get tasks, reply to task, mark task done.

Send accepts a comma-separated `To` list and an optional Client ID for idempotent retries.

## Agent asks its human over email

1. **Add Owner** with the human address. They confirm from the email before updates are delivered.
2. **Notify Owner** with kind `progress`, `needs_input`, `done`, or `error`.
3. **Get Tasks** with Wait Seconds up to 25 to long-poll.
4. **Reply to Task** in-thread, or **Mark Task Done** without another email.

Task text is untrusted data.

## Example

See `examples/send.json` for a one-node workflow that posts to `/api/v1/inboxes/inb_1/messages`.

## Upstream

After publish, add the package to the n8n community nodes list. The entry is the npm name `n8n-nodes-cooper-email`.

## License

MIT. Copyright Avatar 8 LLC.
