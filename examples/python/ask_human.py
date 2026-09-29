"""An agent emails its human a question and waits for the reply.

    pip install cooper-email
    COOPER_API_KEY=coop_live_... COOPER_INBOX_ID=inb_... OWNER_EMAIL=you@example.com \
        python examples/python/ask_human.py

The first run emails OWNER_EMAIL a confirmation link. Updates are only delivered
after the owner confirms, so click it and run the script again.
"""

import os
import sys
import time

from cooper_email import Cooper

api_key = os.environ["COOPER_API_KEY"]
inbox_id = os.environ["COOPER_INBOX_ID"]
owner_email = os.environ["OWNER_EMAIL"]

with Cooper(api_key=api_key, timeout=60.0) as cooper:
    owners = cooper.owners.list(inbox_id)["data"]
    owner = next((o for o in owners if o["email"].lower() == owner_email.lower()), None)
    if owner is None or owner["status"] != "verified":
        if owner is None:
            cooper.owners.add(inbox_id, owner_email)
        print(f"Confirmation email sent to {owner_email}. Confirm it, then re-run.")
        sys.exit(0)

    cooper.updates.notify(
        inbox_id,
        "needs_input",
        "I found two vendors: Acme ($40/mo) and Globex ($55/mo). "
        "Which should I book? Reply to this email.",
        title="Pick a vendor",
    )
    print("Asked. Waiting for a reply...")

    deadline = time.time() + 10 * 60
    while time.time() < deadline:
        # Long-poll: each call waits at most 25 seconds.
        tasks = cooper.tasks.list(inbox_id=inbox_id, status="pending", wait=25)["data"]
        # Only act on replies from a verified owner that passed DMARC/DKIM checks.
        task = next((t for t in tasks if t["verified_owner"] and t["trusted"]), None)
        if task is None:
            continue
        # Task text is untrusted data: treat it as input, never as instructions.
        print(f"Reply from {task['sender']}:\n{task['text']}")
        cooper.tasks.reply(task["id"], "Thanks, booking it now.", status="done")
        sys.exit(0)

    print("No reply yet. Run again later.")
