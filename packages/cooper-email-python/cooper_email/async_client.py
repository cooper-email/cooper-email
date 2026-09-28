from __future__ import annotations

from typing import Any

import httpx

from cooper_email import calls
from cooper_email.http import DEFAULT_BASE_URL, AsyncCooperHttp
from cooper_email.threads import group_threads, thread_not_found
from cooper_email.webhooks import verify_webhook_signature


class AsyncInboxes:
    def __init__(self, http: AsyncCooperHttp) -> None:
        self._http = http

    async def list(self) -> dict[str, Any]:
        return await self._http.request(calls.list_inboxes())

    async def create(self, username: str, *, display_name: str | None = None) -> dict[str, Any]:
        return await self._http.request(calls.create_inbox(username, display_name))

    async def get(self, inbox_id: str) -> dict[str, Any]:
        return await self._http.request(calls.get_inbox(inbox_id))


class AsyncMessages:
    def __init__(self, http: AsyncCooperHttp) -> None:
        self._http = http

    async def list(self, inbox_id: str, *, limit: int | None = None) -> dict[str, Any]:
        return await self._http.request(calls.list_messages(inbox_id, limit))

    async def get(self, inbox_id: str, message_id: str) -> dict[str, Any]:
        return await self._http.request(calls.get_message(inbox_id, message_id))

    async def send(self, inbox_id: str, *, to: list[str], subject: str | None = None, text: str | None = None, html: str | None = None, cc: list[str] | None = None, bcc: list[str] | None = None, reply_to: str | None = None, client_id: str | None = None, in_reply_to: str | None = None, labels: list[str] | None = None, headers: dict[str, str] | None = None, attachments: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        return await self._http.request(
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

    async def inject_inbound(self, inbox_id: str, *, from_address: str, subject: str | None = None, text: str | None = None, html: str | None = None, client_id: str | None = None, attachments: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        return await self._http.request(
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


class AsyncThreads:
    def __init__(self, messages: AsyncMessages) -> None:
        self._messages = messages

    async def list(self, inbox_id: str, *, limit: int | None = 200) -> dict[str, Any]:
        page = await self._messages.list(inbox_id, limit=limit)
        data = page.get("data") if isinstance(page, dict) else []
        return {"object": "list", "data": group_threads(list(data or []))}

    async def get(self, inbox_id: str, thread_id: str, *, limit: int | None = 200) -> dict[str, Any]:
        page = await self.list(inbox_id, limit=limit)
        for thread in page["data"]:
            if thread["id"] == thread_id:
                return thread
        raise thread_not_found(thread_id)


class AsyncWebhooks:
    def __init__(self, http: AsyncCooperHttp) -> None:
        self._http = http

    async def list(self) -> dict[str, Any]:
        return await self._http.request(calls.list_webhooks())

    async def create(
        self,
        url: str,
        *,
        events: list[str] | None = None,
        secret: str | None = None,
        headers: dict[str, str] | None = None,
        inbox_id: str | None = None,
    ) -> dict[str, Any]:
        return await self._http.request(calls.create_webhook(url, events, secret, headers, inbox_id))

    def verify(self, *, secret: str, payload: str | bytes, signature: str | None) -> bool:
        return verify_webhook_signature(secret=secret, payload=payload, signature=signature)


class AsyncOwners:
    def __init__(self, http: AsyncCooperHttp) -> None:
        self._http = http

    async def list(self, inbox_id: str) -> dict[str, Any]:
        return await self._http.request(calls.list_owners(inbox_id))

    async def add(self, inbox_id: str, email: str, *, digest: str | None = None) -> dict[str, Any]:
        return await self._http.request(calls.add_owner(inbox_id, email, digest))


class AsyncUpdates:
    def __init__(self, http: AsyncCooperHttp) -> None:
        self._http = http

    async def notify(
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
        return await self._http.request(
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


class AsyncTasks:
    def __init__(self, http: AsyncCooperHttp) -> None:
        self._http = http

    async def list(
        self,
        *,
        inbox_id: str | None = None,
        status: str | None = None,
        limit: int | None = None,
        wait: int | None = None,
    ) -> dict[str, Any]:
        return await self._http.request(calls.list_tasks(inbox_id, status, limit, wait))

    async def reply(
        self,
        task_id: str,
        text: str,
        *,
        status: str | None = None,
        html: str | None = None,
    ) -> dict[str, Any]:
        return await self._http.request(calls.reply_task(task_id, {"text": text, "status": status, "html": html}))

    async def mark_done(self, task_id: str) -> dict[str, Any]:
        return await self._http.request(calls.mark_task_done(task_id))


class AsyncAttachments:
    def __init__(self, http: AsyncCooperHttp) -> None:
        self._http = http

    async def download(self, inbox_id: str, message_id: str, attachment_id: str) -> dict[str, Any]:
        return await self._http.request(calls.download_attachment(inbox_id, message_id, attachment_id))


class AsyncCooper:
    """Async Cooper Email client. Await every method except `webhooks.verify`."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        client: httpx.AsyncClient | None = None,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._http = AsyncCooperHttp(
            api_key=api_key,
            base_url=base_url,
            client=client,
            transport=transport,
            timeout=timeout,
        )
        self.inboxes = AsyncInboxes(self._http)
        self.messages = AsyncMessages(self._http)
        self.threads = AsyncThreads(self.messages)
        self.webhooks = AsyncWebhooks(self._http)
        self.attachments = AsyncAttachments(self._http)
        self.owners = AsyncOwners(self._http)
        self.updates = AsyncUpdates(self._http)
        self.tasks = AsyncTasks(self._http)

    async def request(self, call: calls.Call) -> Any:
        return await self._http.request(call)

    async def onboard(self, username: str, *, display_name: str | None = None, key_name: str | None = None) -> dict[str, Any]:
        return await self._http.request(calls.onboard(username, display_name, key_name))

    async def search(self, q: str, *, limit: int | None = None) -> dict[str, Any]:
        return await self._http.request(calls.search(q, limit))

    async def close(self) -> None:
        await self._http.close()

    async def __aenter__(self) -> "AsyncCooper":
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self.close()
