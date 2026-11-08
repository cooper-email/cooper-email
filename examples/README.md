# Examples

Short, runnable examples. Every example reads the API key from `COOPER_API_KEY`; never hard-code keys.

HTTP examples need a Bearer key. One unauthenticated `POST /api/v1/onboard` (or MCP `cooper_onboard` with no credentials) returns that key once. It does not sign an OAuth client in, and approving OAuth later does not attach the key:

```bash
curl -s -X POST https://cooperemail.com/api/v1/onboard \
  -H 'content-type: application/json' -d '{"username":"my-agent"}'
# save api_key -> COOPER_API_KEY, inbox.id -> COOPER_INBOX_ID
```

| Example | TypeScript | Python |
| --- | --- | --- |
| Agent emails a human and waits for the reply | [`typescript/ask-human.ts`](typescript/ask-human.ts) | [`python/ask_human.py`](python/ask_human.py) |
| Webhook listener with signature check | [`typescript/webhook-listener.ts`](typescript/webhook-listener.ts) | [`python/webhook_listener.py`](python/webhook_listener.py) |

TypeScript (from the repo root, which resolves `cooper-email` to the local source):

```bash
npm install
npx tsx examples/typescript/ask-human.ts
```

Python:

```bash
pip install cooper-email   # or: pip install -e packages/cooper-email-python
python examples/python/ask_human.py
```
