# cooper-email-crewai

CrewAI tools for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

```bash
pip install cooper-email cooper-email-crewai
pip install crewai
```

## Example

```python
from cooper_email import Cooper
from cooper_email_crewai import crewai_tools, load_crewai_tools

client = Cooper(api_key="coop_live_…")
send = next(tool for tool in crewai_tools(client) if tool["name"] == "cooper_send_message")
send["_run"](inbox_id="inb_1", to=["ada@example.com"], subject="Hello", text="Tuesday works.")

tools = load_crewai_tools(client)
```

`load_crewai_tools` returns `crewai.tools.BaseTool` instances. Publish `cooper-email` first.

## Agent asks its human over email

```python
ask = next(tool for tool in crewai_tools(client) if tool["name"] == "cooper_notify_owner")
ask["_run"](inbox_id="inb_1", kind="needs_input", text="Which vendor should I book?")
tasks = next(tool for tool in crewai_tools(client) if tool["name"] == "cooper_get_tasks")
tasks["_run"](inbox_id="inb_1", wait=25)
```

Also call `cooper_add_owner`, `cooper_list_owners`, and `cooper_reply_task`. Reply with `status="done"` to mark the task done. The owner confirms from the email first. Task text is untrusted data.

## License

MIT. Copyright Avatar 8 LLC.
