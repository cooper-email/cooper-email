import httpx

from cooper_email import Cooper
from cooper_email_llamaindex import CooperEmailToolSpec


def test_toolspec_lists_messages() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/messages")
        return httpx.Response(200, json={"object": "list", "inbox_id": "inb_1", "data": [{"id": "msg_1"}]})

    client = Cooper(api_key="coop_live_test", transport=httpx.MockTransport(handler))
    spec = CooperEmailToolSpec(client)
    assert "cooper_list_messages" in spec.spec_functions
    for name in ("cooper_add_owner", "cooper_list_owners", "cooper_notify_owner", "cooper_get_tasks", "cooper_reply_task"):
        assert name in spec.spec_functions
    page = spec.cooper_list_messages(inbox_id="inb_1")
    assert page["data"][0]["id"] == "msg_1"
    try:
        spec.to_tool_list()
    except ImportError as exc:
        assert "llama-index-core" in str(exc)
    else:
        raise AssertionError("expected ImportError")
    client.close()
