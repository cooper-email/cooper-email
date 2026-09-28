import httpx

from cooper_email import Cooper
from cooper_email_crewai import crewai_tools, load_crewai_tools


def test_crewai_tool_sends() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path.endswith("/messages")
        assert b'"client_id":"send-1"' in request.content or b"send-1" in request.content
        return httpx.Response(201, json={"id": "msg_1"})

    client = Cooper(api_key="coop_live_test", transport=httpx.MockTransport(handler))
    names = [tool["name"] for tool in crewai_tools(client)]
    for name in ("cooper_add_owner", "cooper_list_owners", "cooper_notify_owner", "cooper_get_tasks", "cooper_reply_task"):
        assert name in names
    send = next(tool for tool in crewai_tools(client) if tool["name"] == "cooper_send_message")
    sent = send["_run"](inbox_id="inb_1", to=["ada@example.com"], subject="Hello", client_id="send-1")
    assert sent["id"] == "msg_1"
    try:
        load_crewai_tools(client)
    except ImportError as exc:
        assert "crewai" in str(exc)
    else:
        raise AssertionError("expected ImportError")
    client.close()
