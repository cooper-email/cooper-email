from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import quote


def compact(data: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if value is not None}


def ident(value: str) -> str:
    return quote(value, safe="")


@dataclass(frozen=True)
class Call:
    method: str
    path: str
    json: dict[str, Any] | None = None
    params: dict[str, Any] | None = None
    raw: bool = False


def onboard(username: str, display_name: str | None, key_name: str | None) -> Call:
    return Call(
        "POST",
        "/api/v1/onboard",
        compact({"username": username, "display_name": display_name, "key_name": key_name}),
    )


def list_inboxes() -> Call:
    return Call("GET", "/api/v1/inboxes")


def create_inbox(username: str, display_name: str | None) -> Call:
    return Call("POST", "/api/v1/inboxes", compact({"username": username, "display_name": display_name}))


def get_inbox(inbox_id: str) -> Call:
    return Call("GET", f"/api/v1/inboxes/{ident(inbox_id)}")


def list_messages(inbox_id: str, limit: int | None) -> Call:
    return Call("GET", f"/api/v1/inboxes/{ident(inbox_id)}/messages", params=compact({"limit": limit}))


def get_message(inbox_id: str, message_id: str) -> Call:
    return Call("GET", f"/api/v1/inboxes/{ident(inbox_id)}/messages/{ident(message_id)}")


def send_message(inbox_id: str, body: dict[str, Any]) -> Call:
    return Call("POST", f"/api/v1/inboxes/{ident(inbox_id)}/messages", compact(body))


def inject_inbound(inbox_id: str, body: dict[str, Any]) -> Call:
    return Call("POST", f"/api/v1/inboxes/{ident(inbox_id)}/inbound", compact(body))


def search(q: str, limit: int | None) -> Call:
    return Call("GET", "/api/v1/search", params=compact({"q": q, "limit": limit}))


def list_webhooks() -> Call:
    return Call("GET", "/api/v1/webhooks")


def create_webhook(
    url: str,
    events: list[str] | None,
    secret: str | None,
    headers: dict[str, str] | None = None,
    inbox_id: str | None = None,
) -> Call:
    return Call(
        "POST",
        "/api/v1/webhooks",
        compact(
            {
                "url": url,
                "events": events,
                "secret": secret,
                "headers": headers,
                "inbox_id": inbox_id,
            }
        ),
    )


def list_owners(inbox_id: str) -> Call:
    return Call("GET", f"/api/v1/inboxes/{ident(inbox_id)}/owners")


def add_owner(inbox_id: str, email: str, digest: str | None) -> Call:
    return Call(
        "POST",
        f"/api/v1/inboxes/{ident(inbox_id)}/owners",
        compact({"email": email, "digest": digest}),
    )


def notify_owner(body: dict[str, Any]) -> Call:
    return Call("POST", "/api/v1/updates", compact(body))


def list_tasks(
    inbox_id: str | None,
    status: str | None,
    limit: int | None,
    wait: int | None,
) -> Call:
    return Call(
        "GET",
        "/api/v1/tasks",
        params=compact({"inbox_id": inbox_id, "status": status, "limit": limit, "wait": wait}),
    )


def reply_task(task_id: str, body: dict[str, Any]) -> Call:
    return Call("POST", f"/api/v1/tasks/{ident(task_id)}/reply", compact(body))


def mark_task_done(task_id: str) -> Call:
    return Call("PATCH", f"/api/v1/tasks/{ident(task_id)}", {"status": "done"})


def download_attachment(inbox_id: str, message_id: str, attachment_id: str) -> Call:
    return Call(
        "GET",
        f"/api/v1/inboxes/{ident(inbox_id)}/messages/{ident(message_id)}/attachments/{ident(attachment_id)}",
        raw=True,
    )
