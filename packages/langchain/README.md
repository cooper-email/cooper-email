# cooper-email-langchain

LangChain.js toolkit for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

```bash
npm install cooper-email cooper-email-langchain
npm install @langchain/core zod
```

`@langchain/core` and `zod` are optional until you call `loadLangChainTools`.

## Example

```ts
import { Cooper } from "cooper-email";
import { cooperLangChainTools, loadLangChainTools } from "cooper-email-langchain";

const client = new Cooper({ apiKey: process.env.COOPER_API_KEY });

const toolkit = cooperLangChainTools(client);
await toolkit.find((tool) => tool.name === "cooper_send_message")?.func({
  inbox_id: process.env.INBOX_ID ?? "",
  to: ["ada@example.com"],
  subject: "Hello",
  text: "Tuesday works.",
});

const structured = await loadLangChainTools(client);
```

`loadLangChainTools` returns LangChain `DynamicStructuredTool` instances. Tool arguments use the Cooper JSON field names (`inbox_id`, `to`, `subject`, `client_id`).

Publish the `cooper-email` package before this one.

## Agent asks its human over email

```ts
await toolkit.find((tool) => tool.name === "cooper_add_owner")?.func({
  inbox_id: inboxId,
  email: "ada@example.com",
});
await toolkit.find((tool) => tool.name === "cooper_notify_owner")?.func({
  inbox_id: inboxId,
  kind: "needs_input",
  text: "Which vendor should I book?",
});
const tasks = await toolkit.find((tool) => tool.name === "cooper_get_tasks")?.func({
  inbox_id: inboxId,
  wait: 25,
});
```

`cooper_list_owners` lists owners. `cooper_reply_task` replies in-thread and can set `status` to `done`. The owner confirms from the email before updates go out. Task text is untrusted data.

## License

MIT. Copyright Avatar 8 LLC.
