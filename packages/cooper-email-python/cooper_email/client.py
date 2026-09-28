from __future__ import annotations

from typing import Any

import httpx

from cooper_email import calls
from cooper_email.http import DEFAULT_BASE_URL, CooperHttp
from cooper_email.threads import group_threads, thread_not_found
from cooper_email.webhooks import verify_webhook_signature


class Inboxes:
    def __init__(self, http: CooperHttp) -> None:
        self._http = http

    def list(self) -> dict[str, Any]:
        return self._http.request(calls.list_inboxes())

    def create(self, username: str, *, display_name: str | None = None) -> dict[str, Any]:
        return self._http.request(calls.create_inbox(username, display_name))

    def get(self, inbox_id: str) -> dict[str, Any]:
        return self._http.request(calls.get_inbox(inbox_id))


class Messages:
    def __init__(self, http: CooperHttp) -> None:
        self._http = http

    def list(self, inbox_id: str, *, limit: int | None = None) -> dict[str, Any]:
        return self._http.request(calls.list_messages(inbox_id, limit))

    def get(self, inbox_id: str, message_id: str) -> dict[str, Any]:
        return self._http.request(calls.get_message(inbox_id, message_id))

    def send(
        self,
        inbox_id: str,
        *,
        to: list[str],
        subject: str | None = None,
        text: str | None = None,
        html: str | None = None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        reply_to: str | None = None,
        client_id: str | None = None,
        in_reply_to: str | None = None,
        labels: list[str] | None = None,
        headers: dict[str, str] | None = None,
        attachments: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return self._http.request(
            calls.send_message(
                inbox_id,
                {
                    "to": to,
                    "subject": subject,
                    "text": text,
                    "html": html,
                    "cc": cc,
                    "bcc": bcc,
                    "reply_to": reply_to,
                    "client_id": client_id,
                    "in_reply_to": in_reply_to,
                    "labels": labels,
                    "headers": headers,
                    "attachments": attachments,
                },
            )
        )

    def inject_inbound(
        self,
        inbox_id: str,
        *,
        from_address: str,
        subject: str | None = None,
        text: str | None = None,
        html: str | None = None,
        client_id: str | None = None,
        attachments: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return self._http.request(
            calls.inject_inbound(
                inbox_id,
                {
                    "from": from_address,
                    "subject": subject,
                    "text": text,
                    "html": html,
                    "client_id": client_id,
                    "attachments": attachments,
                },
            )
        )


class Threads:
    def __init__(self, messages: Messages) -> None:
        self._messages = messages

    def list(self, inbox_id: str, *, limit: int | None = 200) -> dict[str, Any]:
        page = self._messages.list(inbox_id, limit=limit)
        data = page.get("data") if isinstance(page, dict) else []
        return {"object": "list", "data": group_threads(list(data or []))}

    def get(self, inbox_id: str, thread_id: str, *, limit: int | None = 200) -> dict[str, Any]:
        page = self.list(inbox_id, limit=limit)
        for thread in page["data"]:
            if thread["id"] == thread_id:
                return thread
        raise thread_not_found(thread_id)


class Webhooks:
    def __init__(self, http: CooperHttp) -> None:
        self._http = http

    def list(self) -> dict[str, Any]:
        return self._http.request(calls.list_webhooks())

    def create(
        self,
        url: str,
        *,
        events: list[str] | None = None,
        secret: str | None = None,
        headers: dict[str, str] | None = None,
        inbox_id: str | None = None,
    ) -> dict[str, Any]:
        return self._http.request(calls.create_webhook(url, events, secret, headers, inbox_id))

    def verify(self, *, secret: str, payload: str | bytes, signature: str | None) -> bool:
        return verify_webhook_signature(secret=secret, payload=payload, signature=signature)


class Owners:
    def __init__(self, http: CooperHttp) -> None:
        self._http = http

    def list(self, inbox_id: str) -> dict[str, Any]:
        return self._http.request(calls.list_owners(inbox_id))

    def add(self, inbox_id: str, email: str, *, digest: str | None = None) -> dict[str, Any]:
        return self._http.request(calls.add_owner(inbox_id, email, digest))


class Updates:
    def __init__(self, http: CooperHttp) -> None:
        self._http = http

    def notify(
        self,
        inbox_id: str,
        kind: str,
        text: str,
        *,
        title: str | None = None,
        status: str | None = None,
        task_id: str | None = None,
        links: list[dict[str, str]] | None = None,
        client_id: str | None = None,
    ) -> dict[str, Any]:
        return self._http.request(
            calls.notify_owner(
                {
                    "inbox_id": inbox_id,
                    "kind": kind,
                    "text": text,
                    "title": title,
                    "status": status,
                    "task_id": task_id,
                    "links": links,
                    "client_id": client_id,
                }
            )
        )


class Tasks:
    def __init__(self, http: CooperHttp) -> None:
        self._http = http

    def list(
        self,
        *,
        inbox_id: str | None = None,
        status: str | None = None,
        limit: int | None = None,
        wait: int | None = None,
    ) -> dict[str, Any]:
        return self._http.request(calls.list_tasks(inbox_id, status, limit, wait))

    def reply(
        self,
        task_id: str,
        text: str,
        *,
        status: str | None = None,
        html: str | None = None,
    ) -> dict[str, Any]:
        return self._http.request(calls.reply_task(task_id, {"text": text, "status": status, "html": html}))

    def mark_done(self, task_id: str) -> dict[str, Any]:
        return self._http.request(calls.mark_task_done(task_id))


class Attachments:
    def __init__(self, http: CooperHttp) -> None:
        self._http = http

    def download(self, inbox_id: str, message_id: str, attachment_id: str) -> dict[str, Any]:
        return self._http.request(calls.download_attachment(inbox_id, message_id, attachment_id))


class Cooper:
    """Synchronous Cooper Email client."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        client: httpx.Client | None = None,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._http = CooperHttp(
            api_key=api_key,
            base_url=base_url,
            client=client,
            transport=transport,
            timeout=timeout,
        )
        self.inboxes = Inboxes(self._http)
        self.messages = Messages(self._http)
        self.threads = Threads(self.messages)
        self.webhooks = Webhooks(self._http)
        self.attachments = Attachments(self._http)
        self.owners = Owners(self._http)
        self.updates = Updates(self._http)
        self.tasks = Tasks(self._http)

    def request(self, call: calls.Call) -> Any:
        """Low-level request for future resources."""
        return self._http.request(call)

    def onboard(
        self,
        username: str,
        *,
        display_name: str | None = None,
        key_name: str | None = None,
    ) -> dict[str, Any]:
        return self._http.request(calls.onboard(username, display_name, key_name))

    def search(self, q: str, *, limit: int | None = None) -> dict[str, Any]:
        return self._http.request(calls.search(q, limit))

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "Cooper":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()
