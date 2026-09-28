import { describe, expect, it } from "vitest";
import { Cooper } from "cooper-email";
import { loadMastraTools, mastraTools } from "../src/index";

describe("Mastra tools", () => {
  it("lists messages through mocked HTTP, including the context wrapper", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ object: "list", inbox_id: "inb_1", data: [{ id: "msg_1" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const client = new Cooper({ apiKey: "coop_live_test", fetch: fetchImpl });
    const catalog = mastraTools(client);
    for (const name of ["cooper_add_owner", "cooper_list_owners", "cooper_notify_owner", "cooper_get_tasks", "cooper_reply_task"]) {
      expect(catalog.some((tool) => tool.id === name)).toBe(true);
    }
    const list = catalog.find((tool) => tool.id === "cooper_list_messages");
    const page = await list?.execute({ context: { inbox_id: "inb_1", limit: 5 } });
    expect(page).toMatchObject({ inbox_id: "inb_1" });
    expect(calls[0]).toContain("/api/v1/inboxes/inb_1/messages?limit=5");
  });

  it("names @mastra/core when createTool cannot be loaded", async () => {
    const client = new Cooper({ fetch: (async () => new Response("{}")) as typeof fetch });
    await expect(loadMastraTools(client)).rejects.toThrow(/@mastra\/core/);
  });
});
