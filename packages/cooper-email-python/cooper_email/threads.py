from __future__ import annotations

from typing import Any

from cooper_email.errors import CooperApiError


def group_threads(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group messages newest-first into threads using `thread_id`.

    The API has no /threads route. The first time an id appears is the latest
    message in that thread.
    """
    order: list[str] = []
    groups: dict[str, list[dict[str, Any]]] = {}
    for message in messages:
        thread_id = str(message.get("thread_id") or "")
        if thread_id not in groups:
            order.append(thread_id)
            groups[thread_id] = [message]
        else:
            groups[thread_id].append(message)
    threads: list[dict[str, Any]] = []
    for thread_id in order:
        items = groups[thread_id]
        latest = items[0] if items else {}
        threads.append(
            {
                "id": thread_id,
                "inbox_id": latest.get("inbox_id") or "",
                "subject": latest.get("subject") or "",
                "latest_at": latest.get("created_at") or "",
                "message_count": len(items),
                "messages": items,
            }
        )
    return threads


def thread_not_found(thread_id: str) -> CooperApiError:
    return CooperApiError(
        status=404,
        type="not_found",
        code="thread_not_found",
        message=f'No thread "{thread_id}" in the latest messages for this inbox.',
        param="thread_id",
    )
