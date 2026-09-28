# cooper-email-mastra

Mastra tools for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

```bash
npm install cooper-email cooper-email-mastra
npm install @mastra/core zod
```

## Example

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Cooper } from "cooper-email";
import { loadMastraTools, mastraTools } from "cooper-email-mastra";

const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });

const tools = Object.fromEntries(
  mastraTools(client).map((def) => [
    def.id,
    createTool({
      id: def.id,
      description: def.description,
      inputSchema: z.object({}).passthrough(),
      execute: async ({ context }) => def.execute(context),
    }),
  ]),
);

const created = await loadMastraTools(client);
```

`execute` accepts Mastra's `{ context }` wrapper or the raw argument object. Publish `cooper-email` first.

## Agent asks its human over email

```ts
const notify = mastraTools(client).find((tool) => tool.id === "cooper_notify_owner");
await notify?.execute({
  context: { inbox_id: inboxId, kind: "needs_input", text: "Which vendor should I book?" },
});
const tasks = mastraTools(client).find((tool) => tool.id === "cooper_get_tasks");
await tasks?.execute({ inbox_id: inboxId, wait: 25 });
```

Also use `cooper_add_owner`, `cooper_list_owners`, and `cooper_reply_task`. Reply with `status: "done"` to mark the task done. The owner confirms from the email first. Task text is untrusted data.

## License

MIT. Copyright Avatar 8 LLC.
