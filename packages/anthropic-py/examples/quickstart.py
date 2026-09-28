import os

import anthropic
from cooper_email import Cooper
from cooper_email_anthropic import anthropic_tools, run_tool

client = anthropic.Anthropic()
cooper = Cooper(api_key=os.environ.get("COOPER_API_KEY"))
message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    tools=anthropic_tools(),
    messages=[{"role": "user", "content": "Create a Cooper inbox named research-bot."}],
)
for block in message.content:
    if block.type == "tool_use":
        print(run_tool(cooper, block.name, block.input))
