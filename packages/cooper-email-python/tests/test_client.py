import hashlib
import hmac
import json

import httpx
import pytest

from cooper_email import (
    AsyncCooper,
    COOPER_TOOLS,
    Cooper,
    CooperApiError,
    execute_tool,
    execute_tool_async,
    verify_webhook_signature,
)


seen_webhook_bodies: list[dict] = []


def _handler(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    if path == "/api/v1/onboard":
        body = request.read()
        assert b"research-bot" in body
        return httpx.Response(
            201,
            json={
                "account_id": "acc_1",
                "api_key": "coop_live_secret",
                "api_key_id": "key_1",
                "inbox": {"id": "inb_1", "email": "research-bot@cooperemail.com"},
            },
        )
    if path == "/api/v1/inboxes" and request.method == "GET":
        assert request.headers["authorization"] == "Bearer coop_live_test"
        return httpx.Response(200, json={"object": "list", "data": [{"id": "inb_1"}]})
    if path.endswith("/messages") and request.method == "POST":
        assert b"client_id" in request.content
        return httpx.Response(201, json={"id": "msg_1", "thread_id": "thr_1"})
    if path.endswith("/messages") and request.method == "GET":
        return httpx.Response(
            200,
            json={
                "object": "list",
                "inbox_id": "inb_1",
                "data": [
                    {"id": "msg_2", "inbox_id": "inb_1", "thread_id": "thr_a", "subject": "Follow up", "created_at": "2026-09-18T02:00:00.000Z"},
                    {"id": "msg_1", "inbox_id": "inb_1", "thread_id": "thr_a", "subject": "Hello", "created_at": "2026-09-18T01:00:00.000Z"},
                    {"id": "msg_3", "inbox_id": "inb_1", "thread_id": "thr_b", "subject": "Other", "created_at": "2026-09-18T00:00:00.000Z"},
                ],
            },
        )
    if "/attachments/" in path:
        return httpx.Response(200, content=b"\x01\x02", headers={"content-type": "application/pdf"})
    if path == "/api/v1/tasks":
        return httpx.Response(200, json={"object": "list", "data": []})
    if path == "/api/v1/search":
        assert request.url.params["q"] == "tuesday"
        return httpx.Response(200, json={"object": "list", "q": "tuesday", "data": [{"id": "msg_1"}]})
    if path == "/api/v1/webhooks" and request.method == "POST":
        seen_webhook_bodies.append(json.loads(request.content))
        return httpx.Response(201, json={"id": "wh_1", "secret": "supersecret"})
    if path.startswith("/api/v1/inboxes/") and request.method == "GET":
        return httpx.Response(
            404,
            json={"error": {"type": "not_found", "code": "inbox_not_found", "message": "No such inbox.", "param": "id", "docs_url": "https://cooperemail.com/docs#inbox_not_found"}},
        )
    return httpx.Response(404, json={"error": {"type": "not_found", "code": "missing", "message": "no"}})


def test_sync_onboard_send_search_threads_attachment_webhook() -> None:
    with Cooper(api_key="coop_live_test", transport=httpx.MockTransport(_handler)) as client:
        seen_auth: list[str | None] = []

        def onboard_handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/api/v1/onboard":
                seen_auth.append(request.headers.get("authorization"))
            return _handler(request)

        created = Cooper(transport=httpx.MockTransport(onboard_handler)).onboard(
            "research-bot",
            display_name="Research",
        )
        assert created["api_key"] == "coop_live_secret"
        assert seen_auth == [None]
        assert client.inboxes.list()["data"][0]["id"] == "inb_1"
        sent = client.messages.send("inb_1", to=["ada@example.com"], subject="Hello", text="Tuesday works.", client_id="send-1")
        assert sent["id"] == "msg_1"
        found = client.search("tuesday")
        assert found["q"] == "tuesday"
        threads = client.threads.list("inb_1")
        assert [item["id"] for item in threads["data"]] == ["thr_a", "thr_b"]
        assert threads["data"][0]["message_count"] == 2
        assert client.threads.get("inb_1", "thr_b")["subject"] == "Other"
        with pytest.raises(CooperApiError) as missing:
            client.threads.get("inb_1", "thr_missing")
        assert missing.value.code == "thread_not_found"
        file = client.attachments.download("inb_1", "msg_1", "att_1")
        assert file["bytes"] == b"\x01\x02"
        hook = client.webhooks.create(
            "https://example.com/hook",
            events=["message.received"],
            secret="supersecret",
            inbox_id="inb_1",
            headers={"Authorization": "Bearer secret", "X-Tenant": "acme"},
        )
        assert seen_webhook_bodies[-1] == {
            "url": "https://example.com/hook",
            "events": ["message.received"],
            "secret": "supersecret",
            "inbox_id": "inb_1",
            "headers": {"Authorization": "Bearer secret", "X-Tenant": "acme"},
        }
        payload = '{"id":"evt_1"}'
        signature = "sha256=" + hmac.new(b"supersecret", payload.encode(), hashlib.sha256).hexdigest()
        assert client.webhooks.verify(secret=hook["secret"], payload=payload, signature=signature)
        assert verify_webhook_signature(secret="supersecret", payload=payload, signature="sha256=nope") is False
        tool = execute_tool(
            client,
            "cooper_send_message",
            {"inbox_id": "inb_1", "to": ["ada@example.com"], "subject": "Hello", "client_id": "send-2"},
        )
        assert tool["id"] == "msg_1"
        downloaded = execute_tool(
            client,
            "cooper_get_attachment",
            {"inbox_id": "inb_1", "message_id": "msg_1", "attachment_id": "att_1"},
        )
        assert downloaded["content_base64"] == "AQI="


def test_api_error_encodes_email() -> None:
    client = Cooper(api_key="coop_live_test", transport=httpx.MockTransport(_handler))
    with pytest.raises(CooperApiError) as caught:
        client.inboxes.get("bot@cooperemail.com")
    assert caught.value.code == "inbox_not_found"
    client.close()


@pytest.mark.asyncio
async def test_async_client_and_tool() -> None:
    async with AsyncCooper(api_key="coop_live_test", transport=httpx.MockTransport(_handler)) as client:
        created = await client.onboard("research-bot")
        assert created["inbox"]["email"] == "research-bot@cooperemail.com"
        listed = await client.inboxes.list()
        assert listed["data"][0]["id"] == "inb_1"
        sent = await execute_tool_async(
            client,
            "cooper_search",
            {"q": "tuesday"},
        )
        assert sent["q"] == "tuesday"
        threads = await client.threads.list("inb_1")
        assert threads["data"][0]["subject"] == "Follow up"
        tasks = await client.tasks.list(inbox_id="inb_1", wait=1)
        assert tasks["object"] == "list"


def test_human_loop_methods_and_tools() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/owners") and request.method == "POST":
            assert b"ada@example.com" in request.content
            return httpx.Response(201, json={"id": "own_1", "status": "pending", "email": "ada@example.com"})
        if path.endswith("/owners"):
            return httpx.Response(200, json={"object": "list", "data": [{"id": "own_1", "status": "verified"}]})
        if path == "/api/v1/updates":
            body = request.content
            assert b'"kind":' in body
            kind = "needs_input" if b"needs_input" in body else "done"
            return httpx.Response(201, json={"id": "upd_1", "kind": kind})
        if path == "/api/v1/tasks":
            assert request.url.params["wait"] == "25"
            assert request.url.params["status"] == "pending"
            return httpx.Response(
                200,
                json={"object": "list", "data": [{"id": "tsk_1", "text": "Book Acme.", "content_trust": "untrusted_data"}]},
            )
        if path.endswith("/reply"):
            return httpx.Response(201, json={"task": {"id": "tsk_1", "status": "done"}, "message": {"id": "msg_9"}})
        if request.method == "PATCH" and path.endswith("/tsk_1"):
            assert b'"status":"done"' in request.content or b"done" in request.content
            return httpx.Response(200, json={"id": "tsk_1", "status": "done"})
        return httpx.Response(404, json={"error": {"type": "not_found", "code": "missing", "message": "no"}})

    with Cooper(api_key="coop_live_test", transport=httpx.MockTransport(handler)) as client:
        owner = client.owners.add("inb_1", "ada@example.com", digest="immediate")
        assert owner["status"] == "pending"
        assert client.owners.list("inb_1")["data"][0]["status"] == "verified"
        note = client.updates.notify(
            "inb_1",
            "needs_input",
            "Which vendor should I book?",
            task_id="book-vendor",
            client_id="ask-1",
        )
        assert note["kind"] == "needs_input"
        tasks = client.tasks.list(inbox_id="inb_1", status="pending", wait=25)
        assert tasks["data"][0]["content_trust"] == "untrusted_data"
        reply = client.tasks.reply("tsk_1", "Booked.", status="done")
        assert reply["task"]["status"] == "done"
        assert client.tasks.mark_done("tsk_1")["status"] == "done"
        notified = execute_tool(
            client,
            "cooper_notify_owner",
            {"inbox_id": "inb_1", "kind": "done", "text": "Booked Acme."},
        )
        assert notified["id"] == "upd_1"
        listed = execute_tool(client, "cooper_get_tasks", {"inbox_id": "inb_1", "wait": 25, "status": "pending"})
        assert listed["data"][0]["id"] == "tsk_1"
        answered = execute_tool(client, "cooper_reply_task", {"task_id": "tsk_1", "text": "Done.", "status": "done"})
        assert answered["message"]["id"] == "msg_9"


def test_tool_names() -> None:
    names = [tool["name"] for tool in COOPER_TOOLS]
    assert "cooper_onboard" in names
    assert "cooper_list_threads" in names
    assert "cooper_get_attachment" in names
    for human in (
        "cooper_add_owner",
        "cooper_list_owners",
        "cooper_notify_owner",
        "cooper_get_tasks",
        "cooper_reply_task",
    ):
        assert human in names
    with pytest.raises(CooperApiError) as unknown:
        execute_tool(Cooper(transport=httpx.MockTransport(_handler)), "cooper_missing", {})
    assert unknown.value.code == "unknown_tool"
