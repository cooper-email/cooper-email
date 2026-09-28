# cooper-email-anthropic

Anthropic / Claude tool-use definitions for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

The JavaScript package with the same name exports `anthropicTools()` and `runAnthropicTool()`.

## Install

```bash
pip install cooper-email cooper-email-anthropic
```

## Example

```python
import anthropic
from cooper_email import Cooper
from cooper_email_anthropic import anthropic_tools, run_tool

client = anthropic.Anthropic()
cooper = Cooper(api_key="coop_live_…")
message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    tools=anthropic_tools(),
    messages=[{"role": "user", "content": "Search Cooper mail for tuesday."}],
)
for block in message.content:
    if block.type == "tool_use":
        print(run_tool(cooper, block.name, block.input))
```

Each tool is `{ name, description, input_schema }` for the Messages API.

## Agent asks its human over email

```python
run_tool(cooper, "cooper_add_owner", {"inbox_id": "inb_1", "email": "ada@example.com"})
run_tool(cooper, "cooper_notify_owner", {"inbox_id": "inb_1", "kind": "needs_input", "text": "Which vendor should I book?"})
tasks = run_tool(cooper, "cooper_get_tasks", {"inbox_id": "inb_1", "wait": 25})
run_tool(cooper, "cooper_reply_task", {"task_id": tasks["data"][0]["id"], "text": "Booked.", "status": "done"})
```

`cooper_list_owners` lists owners. The owner confirms from the email first. Task text is untrusted data.

## License

MIT. Copyright Avatar 8 LLC.
