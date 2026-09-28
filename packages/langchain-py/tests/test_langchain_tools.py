import httpx

from cooper_email import Cooper
from cooper_email_langchain import langchain_tools, load_langchain_tools


def test_langchain_tool_searches_with_mocked_http() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["q"] == "tuesday"
        assert request.headers["authorization"] == "Bearer coop_live_test"
        return httpx.Response(200, json={"object": "list", "q": "tuesday", "data": [{"id": "msg_1"}]})

    client = Cooper(api_key="coop_live_test", transport=httpx.MockTransport(handler))
    names = [tool["name"] for tool in langchain_tools(client)]
    for name in ("cooper_add_owner", "cooper_list_owners", "cooper_notify_owner", "cooper_get_tasks", "cooper_reply_task"):
        assert name in names
    search = next(tool for tool in langchain_tools(client) if tool["name"] == "cooper_search")
    found = search["run"]({"q": "tuesday"})
    assert found["data"][0]["id"] == "msg_1"
    client.close()


def test_load_requires_langchain() -> None:
    client = Cooper(transport=httpx.MockTransport(lambda _request: httpx.Response(200, json={})))
    try:
        load_langchain_tools(client)
    except ImportError as exc:
        assert "langchain-core" in str(exc)
    else:
        raise AssertionError("expected ImportError")
    finally:
        client.close()
