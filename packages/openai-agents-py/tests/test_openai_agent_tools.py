import httpx

from cooper_email import Cooper
from cooper_email_openai_agents import function_tools, load_function_tools


def test_function_tool_gets_message() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/messages/msg_1")
        return httpx.Response(200, json={"id": "msg_1", "extracted_text": "Tuesday works."})

    client = Cooper(api_key="coop_live_test", transport=httpx.MockTransport(handler))
    names = [fn.__name__ for fn in function_tools(client)]
    for name in ("cooper_add_owner", "cooper_list_owners", "cooper_notify_owner", "cooper_get_tasks", "cooper_reply_task"):
        assert name in names
    get_message = next(fn for fn in function_tools(client) if fn.__name__ == "cooper_get_message")
    message = get_message(inbox_id="inb_1", message_id="msg_1")
    assert message["extracted_text"] == "Tuesday works."
    assert "stored message" in (get_message.__doc__ or "")
    try:
        load_function_tools(client)
    except ImportError as exc:
        assert "openai-agents" in str(exc)
    else:
        raise AssertionError("expected ImportError")
    client.close()
