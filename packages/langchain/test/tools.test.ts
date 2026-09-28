import { describe, expect, it } from "vitest";
import { Cooper } from "cooper-email";
import { cooperLangChainTools, loadLangChainTools, runTool } from "../src/index";

describe("LangChain toolkit", () => {
  it("sends mail through a mocked Cooper API", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(JSON.stringify({ id: "msg_1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const client = new Cooper({ apiKey: "coop_live_test", fetch: fetchImpl, baseUrl: "https://cooperemail.com" });
    const tools = cooperLangChainTools(client);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "cooper_onboard",
        "cooper_send_message",
        "cooper_search",
        "cooper_add_owner",
        "cooper_list_owners",
        "cooper_notify_owner",
        "cooper_get_tasks",
        "cooper_reply_task",
      ]),
    );
    const sent = await tools.find((tool) => tool.name === "cooper_send_message")?.func({
      inbox_id: "inb_1",
      to: ["ada@example.com"],
      subject: "Hello",
    });
    expect(sent).toMatchObject({ id: "msg_1" });
    expect(calls[0]).toBe("POST https://cooperemail.com/api/v1/inboxes/inb_1/messages");
    expect(await runTool(client, "cooper_list_inboxes", {})).toBeDefined();
  });

  it("tells you how to install LangChain when the peer dependency is missing", async () => {
    const client = new Cooper({ fetch: (async () => new Response("{}")) as typeof fetch });
    await expect(loadLangChainTools(client)).rejects.toThrow(/@langchain\/core/);
  });
});
