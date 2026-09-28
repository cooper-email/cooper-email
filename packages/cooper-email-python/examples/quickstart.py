"""Quick start for the Cooper Email Python SDK.

    pip install cooper-email
"""

import os

from cooper_email import Cooper, verify_webhook_signature

with Cooper() as fresh:
    onboard = fresh.onboard("research-bot", display_name="Research")

with Cooper(api_key=onboard["api_key"] or os.environ.get("COOPER_API_KEY")) as cooper:
    sent = cooper.messages.send(
        onboard["inbox"]["id"],
        to=["ada@example.com"],
        subject="Hello",
        text="Tuesday works.",
        client_id="send-1",
    )
    messages = cooper.messages.list(onboard["inbox"]["id"])
    found = cooper.search("tuesday")
    threads = cooper.threads.list(onboard["inbox"]["id"])
    print(sent["id"], len(messages["data"]), len(found["data"]), len(threads["data"]))

payload = '{"type":"message.received"}'
print(
    verify_webhook_signature(
        secret=os.environ.get("COOPER_WEBHOOK_SECRET", ""),
        payload=payload,
        signature=os.environ.get("COOPER_WEBHOOK_SIGNATURE"),
    )
)
