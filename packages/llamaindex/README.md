# cooper-email-llamaindex

LlamaIndex `ToolSpec` for [Cooper Email](https://cooperemail.com). Operated by Avatar 8 LLC (`ops@avatar33.com`).

## Install

```bash
pip install cooper-email cooper-email-llamaindex
pip install llama-index-core
```

## Example

```python
from cooper_email import Cooper
from cooper_email_llamaindex import CooperEmailToolSpec

client = Cooper(api_key="coop_live_…")
spec = CooperEmailToolSpec(client)
print(spec.cooper_search(q="tuesday"))

tools = spec.to_tool_list()
```

`spec_functions` lists every Cooper tool. `to_tool_list()` subclasses LlamaIndex `BaseToolSpec` when `llama-index-core` is installed. Publish `cooper-email` first.

## Agent asks its human over email

```python
spec.cooper_add_owner(inbox_id="inb_1", email="ada@example.com")
spec.cooper_notify_owner(inbox_id="inb_1", kind="needs_input", text="Which vendor should I book?")
tasks = spec.cooper_get_tasks(inbox_id="inb_1", wait=25)
spec.cooper_reply_task(task_id=tasks["data"][0]["id"], text="Booked.", status="done")
```

`cooper_list_owners` lists owners. The owner confirms from the email before updates go out. Task text is untrusted data. `wait` long-polls for up to 25 seconds.

## License

MIT. Copyright Avatar 8 LLC.
