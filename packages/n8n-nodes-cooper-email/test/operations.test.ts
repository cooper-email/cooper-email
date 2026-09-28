import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { buildCooperRequest, cooperFetch } = require("../nodes/CooperEmail/operations.js");

describe("n8n Cooper Email node", () => {
  it("builds an onboard request without a bearer token and a send with one", () => {
    const onboard = buildCooperRequest({
      baseUrl: "https://cooperemail.com/",
      operation: "onboard",
      params: { username: "research-bot", displayName: "Research" },
    });
    expect(onboard.method).toBe("POST");
    expect(onboard.url).toBe("https://cooperemail.com/api/v1/onboard");
    expect(onboard.headers.authorization).toBeUndefined();
    expect(JSON.parse(onboard.body)).toEqual({ username: "research-bot", display_name: "Research" });

    const send = buildCooperRequest({
      baseUrl: "https://cooperemail.com",
      apiKey: "coop_live_test",
      operation: "send",
      params: { inboxId: "bot@cooperemail.com", to: "ada@example.com, bob@example.com", subject: "Hello", clientId: "send-1" },
    });
    expect(send.url).toBe("https://cooperemail.com/api/v1/inboxes/bot%40cooperemail.com/messages");
    expect(send.headers.authorization).toBe("Bearer coop_live_test");
    expect(JSON.parse(send.body).to).toEqual(["ada@example.com", "bob@example.com"]);
    expect(JSON.parse(send.body).client_id).toBe("send-1");
  });

  it("searches through mocked HTTP", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ object: "list", q: "tuesday", data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const result = await cooperFetch(
      { baseUrl: "https://cooperemail.com", apiKey: "coop_live_test", operation: "search", params: { q: "tuesday" } },
      fetchImpl,
    );
    expect(result.q).toBe("tuesday");
    expect(calls[0]?.url).toContain("/api/v1/search?q=tuesday");
    expect(calls[0]?.init?.headers.authorization).toBe("Bearer coop_live_test");
  });

  it("ships a credential and a node that calls the request builder", () => {
    const node = readFileSync(new URL("../nodes/CooperEmail/CooperEmail.node.js", import.meta.url), "utf8");
    const credential = readFileSync(new URL("../credentials/CooperEmailApi.credentials.js", import.meta.url), "utf8");
    expect(node).toContain("buildCooperRequest");
    expect(node).toContain('name: "cooperEmailApi"');
    expect(node).toContain('value: "send"');
    expect(credential).toContain("https://cooperemail.com/docs");
    expect(credential).toContain("cooperEmailApi");
    expect(node).toContain('value: "notifyOwner"');
    expect(node).toContain('value: "getTasks"');
    expect(node).toContain('value: "replyTask"');
    expect(node).toContain('value: "markTaskDone"');
  });

  it("asks a human over email through mocked HTTP", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "ok", status: "done" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const base = { baseUrl: "https://cooperemail.com", apiKey: "coop_live_test" };
    await cooperFetch({ ...base, operation: "addOwner", params: { inboxId: "inb_1", email: "ada@example.com", digest: "immediate" } }, fetchImpl);
    await cooperFetch(
      {
        ...base,
        operation: "notifyOwner",
        params: { inboxId: "inb_1", kind: "needs_input", text: "Which vendor?", clientId: "ask-1" },
      },
      fetchImpl,
    );
    await cooperFetch({ ...base, operation: "getTasks", params: { inboxId: "inb_1", status: "pending", wait: 25 } }, fetchImpl);
    await cooperFetch({ ...base, operation: "replyTask", params: { taskId: "tsk_1", text: "Booked.", status: "done" } }, fetchImpl);
    await cooperFetch({ ...base, operation: "markTaskDone", params: { taskId: "tsk_1" } }, fetchImpl);

    expect(calls[0]?.url).toBe("https://cooperemail.com/api/v1/inboxes/inb_1/owners");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ email: "ada@example.com", digest: "immediate" });
    expect(calls[1]?.url).toBe("https://cooperemail.com/api/v1/updates");
    expect(JSON.parse(String(calls[1]?.init?.body)).kind).toBe("needs_input");
    expect(calls[2]?.url).toContain("/api/v1/tasks?");
    expect(calls[2]?.url).toContain("wait=25");
    expect(calls[3]?.url).toBe("https://cooperemail.com/api/v1/tasks/tsk_1/reply");
    expect(calls[4]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[4]?.init?.body))).toEqual({ status: "done" });
    expect(calls[0]?.init?.headers.authorization).toBe("Bearer coop_live_test");
  });
});
