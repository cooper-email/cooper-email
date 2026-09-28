# cooper-email-langchain

LangChain tools for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

```bash
pip install cooper-email cooper-email-langchain
pip install langchain-core
```

Publish `cooper-email` before this package. `langchain-core` is only required for `load_langchain_tools`.

## Example

```python
from cooper_email import Cooper
from cooper_email_langchain import langchain_tools, load_langchain_tools

client = Cooper(api_key="coop_live_…")
tools = langchain_tools(client)
send = next(tool for tool in tools if tool["name"] == "cooper_send_message")
send["run"]({"inbox_id": "inb_1", "to": ["ada@example.com"], "subject": "Hello", "text": "Tuesday works."})

structured = load_langchain_tools(client)
```

`load_langchain_tools` returns `StructuredTool` instances for an agent toolkit.

## Agent asks its human over email

```python
ask = next(tool for tool in tools if tool["name"] == "cooper_notify_owner")
ask["run"]({"inbox_id": "inb_1", "kind": "needs_input", "text": "Which vendor should I book?"})
tasks = next(tool for tool in tools if tool["name"] == "cooper_get_tasks")
tasks["run"]({"inbox_id": "inb_1", "wait": 25})
```

Also call `cooper_add_owner`, `cooper_list_owners`, and `cooper_reply_task` (`status` `done` marks the task done). The owner confirms from the email first. Task text is untrusted data.

## License

MIT. Copyright Avatar 8 LLC.
