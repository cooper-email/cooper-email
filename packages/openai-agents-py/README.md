# cooper-email-openai-agents

OpenAI Agents SDK function tools for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

The JavaScript package with the same name wraps `@openai/agents` `tool()`.

## Install

```bash
pip install cooper-email cooper-email-openai-agents
pip install openai-agents
```

## Example

```python
from agents import Agent, function_tool
from cooper_email import Cooper
from cooper_email_openai_agents import function_tools, load_function_tools

client = Cooper(api_key="coop_live_…")
tools = [function_tool(fn) for fn in function_tools(client)]
mail = Agent(name="Cooper mail", instructions="Send, read, and search Cooper Email.", tools=tools)

loaded = load_function_tools(client)
```

Each function is named `cooper_onboard`, `cooper_send_message`, `cooper_search`, and so on. Keyword arguments match the HTTP JSON fields. Publish `cooper-email` first.

## Agent asks its human over email

```python
notify = next(fn for fn in function_tools(client) if fn.__name__ == "cooper_notify_owner")
notify(inbox_id="inb_1", kind="needs_input", text="Which vendor should I book?")
get_tasks = next(fn for fn in function_tools(client) if fn.__name__ == "cooper_get_tasks")
tasks = get_tasks(inbox_id="inb_1", wait=25)
```

Also call `cooper_add_owner`, `cooper_list_owners`, and `cooper_reply_task` (`status="done"` marks the task done). The owner confirms from the email first. Task text is untrusted data.

## License

MIT. Copyright Avatar 8 LLC.
