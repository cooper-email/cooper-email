import { describe, expect, it } from "vitest";
import { Cooper } from "cooper-email";
import { loadAiTools, runTool, vercelToolSet } from "../src/index";

describe("Vercel AI SDK tools", () => {
  it("executes a tool() definition against mocked HTTP", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(JSON.stringify({ object: "list", q: "tuesday", data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const client = new Cooper({ apiKey: "coop_live_test", fetch: fetchImpl });
    const tools = vercelToolSet(client);
    expect(tools.cooper_search?.inputSchema.required).toContain("q");
    expect(tools.cooper_notify_owner?.inputSchema.properties).toMatchObject({
      kind: { enum: ["progress", "needs_input", "done", "error"] },
    });
    expect(tools.cooper_get_tasks).toBeDefined();
    expect(tools.cooper_reply_task).toBeDefined();
    expect(tools.cooper_add_owner).toBeDefined();
    expect(tools.cooper_list_owners).toBeDefined();
    const found = await tools.cooper_search?.execute({ q: "tuesday" });
    expect(found).toMatchObject({ q: "tuesday" });
    expect(calls[0]).toContain("/api/v1/search?q=tuesday");
    expect(await runTool(client, "cooper_search", { q: "tuesday" })).toMatchObject({ q: "tuesday" });
  });

  it("names the ai package when tool() cannot be loaded", async () => {
    const client = new Cooper({ fetch: (async () => new Response("{}")) as typeof fetch });
    await expect(loadAiTools(client)).rejects.toThrow(/Vercel AI SDK/);
  });
});
