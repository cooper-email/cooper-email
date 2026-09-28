import { describe, expect, it } from "vitest";
import { Cooper } from "cooper-email";
import { loadOpenAIAgentTools, openaiAgentTools } from "../src/index";

describe("OpenAI Agents SDK (JavaScript)", () => {
  it("gets a message through mocked HTTP", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ id: "msg_1", extracted_text: "Tuesday works." }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const client = new Cooper({ apiKey: "coop_live_test", fetch: fetchImpl });
    const agentTools = openaiAgentTools(client);
    for (const name of ["cooper_add_owner", "cooper_list_owners", "cooper_notify_owner", "cooper_get_tasks", "cooper_reply_task"]) {
      expect(agentTools.some((tool) => tool.name === name)).toBe(true);
    }
    const getMessage = agentTools.find((tool) => tool.name === "cooper_get_message");
    const message = await getMessage?.execute({ inbox_id: "inb_1", message_id: "msg_1" });
    expect(message).toMatchObject({ extracted_text: "Tuesday works." });
    expect(calls[0]).toContain("/api/v1/inboxes/inb_1/messages/msg_1");
  });

  it("names @openai/agents when tool() cannot be loaded", async () => {
    const client = new Cooper({ fetch: (async () => new Response("{}")) as typeof fetch });
    await expect(loadOpenAIAgentTools(client)).rejects.toThrow(/@openai\/agents/);
  });
});
