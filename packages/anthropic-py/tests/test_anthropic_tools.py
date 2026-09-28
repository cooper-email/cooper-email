import httpx

from cooper_email import Cooper
from cooper_email_anthropic import anthropic_tools, run_tool


def test_anthropic_tool_onboards() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/onboard"
        assert "authorization" not in request.headers
        return httpx.Response(201, json={"api_key": "coop_live_secret", "inbox": {"email": "research-bot@cooperemail.com"}})

    tools = anthropic_tools()
    onboard = next(tool for tool in tools if tool["name"] == "cooper_onboard")
    assert "username" in onboard["input_schema"]["required"]
    names = [tool["name"] for tool in tools]
    for name in ("cooper_add_owner", "cooper_list_owners", "cooper_notify_owner", "cooper_get_tasks", "cooper_reply_task"):
        assert name in names
    client = Cooper(transport=httpx.MockTransport(handler))
    created = run_tool(client, "cooper_onboard", {"username": "research-bot"})
    assert created["inbox"]["email"] == "research-bot@cooperemail.com"
    client.close()
