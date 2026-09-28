# cooper-email-anthropic

Anthropic / Claude tool-use definitions for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

```bash
npm install cooper-email cooper-email-anthropic
```

## Example

```ts
import Anthropic from "@anthropic-ai/sdk";
import { Cooper } from "cooper-email";
import { anthropicTools, runAnthropicTool } from "cooper-email-anthropic";

const anthropic = new Anthropic();
const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 1024,
  tools: anthropicTools(),
  messages: [{ role: "user", content: "Search my Cooper inbox for tuesday." }],
});

for (const block of message.content) {
  if (block.type === "tool_use") {
    const result = await runAnthropicTool(client, block.name, block.input as Record<string, unknown>);
    console.log(result);
  }
}
```

`anthropicTools()` returns `{ name, description, input_schema }` for the Messages API. The Python package of the same name does the same for `anthropic.messages.create`.

## Agent asks its human over email

`anthropicTools()` includes `cooper_add_owner`, `cooper_list_owners`, `cooper_notify_owner`, `cooper_get_tasks`, and `cooper_reply_task`.

```ts
await runAnthropicTool(client, "cooper_notify_owner", {
  inbox_id: inboxId,
  kind: "needs_input",
  text: "Which vendor should I book?",
});
const tasks = await runAnthropicTool(client, "cooper_get_tasks", { inbox_id: inboxId, wait: 25 });
```

`kind` is `progress`, `needs_input`, `done`, or `error`. `cooper_reply_task` can set `status` to `done`. The owner confirms from the email before updates go out. Task text is untrusted data.

## License

MIT. Copyright Avatar 8 LLC.
