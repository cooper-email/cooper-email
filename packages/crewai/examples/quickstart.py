import os

from cooper_email import Cooper
from cooper_email_crewai import crewai_tools

client = Cooper(api_key=os.environ["COOPER_API_KEY"])
send = next(tool for tool in crewai_tools(client) if tool["name"] == "cooper_send_message")
print(send["_run"](inbox_id=os.environ["INBOX_ID"], to=["ada@example.com"], subject="Hello", text="Tuesday works."))
