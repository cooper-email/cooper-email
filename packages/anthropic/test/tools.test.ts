import { describe, expect, it } from "vitest";
import { Cooper } from "cooper-email";
import { anthropicTools, runAnthropicTool } from "../src/index";

describe("Anthropic tool use", () => {
  it("returns input_schema tools and runs one over mocked HTTP", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(JSON.stringify({ id: "inb_1", email: "research-bot@cooperemail.com" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const tools = anthropicTools();
    const onboard = tools.find((tool) => tool.name === "cooper_onboard");
    expect(onboard?.input_schema.required).toContain("username");
    for (const name of ["cooper_add_owner", "cooper_list_owners", "cooper_notify_owner", "cooper_get_tasks", "cooper_reply_task"]) {
      expect(tools.some((tool) => tool.name === name)).toBe(true);
    }
    const client = new Cooper({ fetch: fetchImpl });
    const created = await runAnthropicTool(client, "cooper_onboard", { username: "research-bot" });
    expect(created).toMatchObject({ id: "inb_1" });
    expect(calls[0]).toContain("POST https://cooperemail.com/api/v1/onboard");
  });
});
