import os

from cooper_email import Cooper
from cooper_email_langchain import langchain_tools, load_langchain_tools

client = Cooper(api_key=os.environ["COOPER_API_KEY"])
tools = langchain_tools(client)
send = next(tool for tool in tools if tool["name"] == "cooper_send_message")
print(
    send["run"](
        {
            "inbox_id": os.environ["INBOX_ID"],
            "to": ["ada@example.com"],
            "subject": "Hello",
            "text": "Tuesday works.",
        }
    )
)

# When langchain-core is installed:
# structured = load_langchain_tools(client)
