# cooper-email-openapi

OpenAPI 3.1 for [Cooper Email](https://cooperemail.com), for Zapier and Make custom apps. Operated by Avatar 8 LLC (`ops@avatar33.com`).

Live spec:

- https://cooperemail.com/openapi.json
- https://cooperemail.com/api/openapi.json

`openapi.json` in this folder is a snapshot of the production spec (server `https://cooperemail.com`). The live URLs above are the source of truth; if they differ, use the live spec.

## Zapier

1. https://developer.zapier.com/ → Start a Zapier Integration → Import an existing API.
2. Choose OpenAPI and paste https://cooperemail.com/openapi.json.
3. Authentication: API Key / Bearer. Users paste `coop_live_…`.
4. Onboard (`operationId: onboard`) has no security requirement. The other operations use `bearerAuth`.

## Make

1. https://www.make.com/en/help/apps/custom-apps → Create a custom app from an OpenAPI document.
2. URL: https://cooperemail.com/openapi.json
3. Set the bearer token connection to the Cooper API key.

Threads are not a REST path. Messages include `thread_id`. Owners, updates, and tasks are in this document: `addOwner`, `listOwners`, `notifyOwner`, `listTasks` (`wait` long-poll), `replyTask`, and `updateTask` (mark done).

## License

MIT. Copyright Avatar 8 LLC.
