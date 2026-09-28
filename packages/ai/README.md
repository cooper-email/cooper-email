# cooper-email-ai

Vercel AI SDK `tool()` definitions for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

```bash
npm install cooper-email cooper-email-ai ai
```

## Example

```ts
import { jsonSchema, tool } from "ai";
import { Cooper } from "cooper-email";
import { loadAiTools, vercelToolSet } from "cooper-email-ai";

const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });

const defs = vercelToolSet(client);
const tools = Object.fromEntries(
  Object.entries(defs).map(([name, def]) => [
    name,
    tool({
      description: def.description,
      inputSchema: jsonSchema(def.inputSchema),
      execute: def.execute,
    }),
  ]),
);

const loaded = await loadAiTools(client);
```

Pass `tools` to `generateText` or `streamText`. Publish `cooper-email` before this package.

## Agent asks its human over email

```ts
await defs.cooper_add_owner?.execute({ inbox_id: inboxId, email: "ada@example.com" });
await defs.cooper_notify_owner?.execute({
  inbox_id: inboxId,
  kind: "needs_input",
  text: "Which vendor should I book?",
});
const tasks = await defs.cooper_get_tasks?.execute({ inbox_id: inboxId, wait: 25 });
```

`cooper_list_owners` lists owners. `cooper_reply_task` replies in-thread. Pass `status: "done"` to mark the task done. The owner confirms from the email before updates go out. Task text is untrusted data. `kind` is `progress`, `needs_input`, `done`, or `error`.

## License

MIT. Copyright Avatar 8 LLC.
