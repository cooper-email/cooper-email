# cooper-email-openai-agents

OpenAI Agents SDK tools for [Cooper Email](https://cooperemail.com), JavaScript package. Operated by Avatar 8 LLC (`ops@avatar33.com`).

The Python package with the same name wraps `agents.function_tool`.

## Install

```bash
npm install cooper-email cooper-email-openai-agents
npm install @openai/agents zod
```

## Example

```ts
import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { Cooper } from "cooper-email";
import { loadOpenAIAgentTools, openaiAgentTools } from "cooper-email-openai-agents";

const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });

const tools = openaiAgentTools(client).map((def) =>
  tool({
    name: def.name,
    description: def.description,
    parameters: z.object({}).passthrough(),
    execute: async (input) => def.execute(input as Record<string, unknown>),
  }),
);

const mailAgent = new Agent({
  name: "Cooper mail",
  instructions: "Use Cooper Email tools to send, read, and search mail.",
  tools,
});

const loaded = await loadOpenAIAgentTools(client);
```

Publish `cooper-email` before this package.

## Agent asks its human over email

The toolkit includes `cooper_add_owner`, `cooper_list_owners`, `cooper_notify_owner`, `cooper_get_tasks`, and `cooper_reply_task`.

```ts
await openaiAgentTools(client)
  .find((tool) => tool.name === "cooper_notify_owner")
  ?.execute({ inbox_id: inboxId, kind: "needs_input", text: "Which vendor should I book?" });
const tasks = await openaiAgentTools(client)
  .find((tool) => tool.name === "cooper_get_tasks")
  ?.execute({ inbox_id: inboxId, wait: 25 });
```

`wait` long-polls for up to 25 seconds. `cooper_reply_task` can set `status` to `done`. The owner confirms from the email before updates go out. Task text is untrusted data.

## License

MIT. Copyright Avatar 8 LLC.
