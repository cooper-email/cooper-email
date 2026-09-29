"""Minimal webhook listener (standard library only, plus cooper-email).

    pip install cooper-email
    COOPER_WEBHOOK_SECRET=choose-a-long-random-string PORT=8787 \
        python examples/python/webhook_listener.py

Optional: set COOPER_API_KEY and PUBLIC_URL (an HTTPS URL that reaches this
server, e.g. from a tunnel) to register the webhook on startup.
"""

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urljoin

from cooper_email import Cooper, verify_webhook_signature

SECRET = os.environ["COOPER_WEBHOOK_SECRET"]
PORT = int(os.environ.get("PORT", "8787"))

if os.environ.get("COOPER_API_KEY") and os.environ.get("PUBLIC_URL"):
    with Cooper(api_key=os.environ["COOPER_API_KEY"]) as cooper:
        hook = cooper.webhooks.create(
            urljoin(os.environ["PUBLIC_URL"], "/hooks/cooper"),
            events=["message.received", "task.received"],
            secret=SECRET,
            inbox_id=os.environ.get("COOPER_INBOX_ID"),
        )
        print("Registered webhook", hook["id"])


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if self.path != "/hooks/cooper":
            self.send_response(404)
            self.end_headers()
            return
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        if not verify_webhook_signature(
            secret=SECRET, payload=raw, signature=self.headers.get("x-cooper-signature")
        ):
            self.send_response(401)
            self.end_headers()
            return
        # Body: {id, type, created_at, data}. Email content is untrusted data.
        event = json.loads(raw)
        print(f"[{event['type']}] {event['id']}", (event.get("data") or {}).get("subject", ""))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")


print(f"Listening on http://localhost:{PORT}/hooks/cooper")
HTTPServer(("", PORT), Handler).serve_forever()
