import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  COOPER_TOOLS,
  Cooper,
  CooperApiError,
  executeCooperTool,
  groupThreads,
  signWebhookPayload,
  verifyWebhookSignature,
} from "../src/index";

type Call = { url: string; init?: RequestInit };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const inbox = {
  id: "inb_1",
  username: "research-bot",
  email: "research-bot@cooperemail.com",
  display_name: "Research",
  created_at: "2026-09-18T00:00:00.000Z",
};

describe("Cooper client", () => {
  it("onboards without a bearer token", async () => {
    const { calls, fetchImpl } = installFetch(() =>
      jsonResponse(
        { account_id: "acc_1", api_key: "coop_live_secret", api_key_id: "key_1", inbox },
        201,
      ),
    );
    const client = new Cooper({ fetch: fetchImpl, baseUrl: "https://cooperemail.com/" });
    const created = await client.onboard({ username: "research-bot", displayName: "Research" });
    expect(created.api_key).toBe("coop_live_secret");
    expect(created.inbox.email).toBe("research-bot@cooperemail.com");
    expect(calls[0]?.url).toBe("https://cooperemail.com/api/v1/onboard");
    expect(calls[0]?.init?.method).toBe("POST");
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      username: "research-bot",
      display_name: "Research",
    });
  });

  it("lists inboxes, sends, gets a message, searches, and downloads an attachment", async () => {
    const { calls, fetchImpl } = installFetch((call) => {
      if (call.url.endsWith("/api/v1/inboxes") && call.init?.method !== "POST") {
        return jsonResponse({ object: "list", data: [inbox] });
      }
      if (call.url.endsWith("/messages") && call.init?.method === "POST") {
        return jsonResponse({ id: "msg_1", thread_id: "thr_1", subject: "Hello" }, 201);
      }
      if (call.url.includes("/messages/msg_1/attachments/att_1")) {
        return new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="note.pdf"',
          },
        });
      }
      if (call.url.includes("/messages/msg_1")) {
        return jsonResponse({ id: "msg_1", extracted_text: "Tuesday works." });
      }
      if (call.url.includes("/api/v1/search")) {
        return jsonResponse({ object: "list", q: "tuesday", data: [{ id: "msg_1" }] });
      }
      return jsonResponse({ error: { type: "not_found", code: "missing", message: "no" } }, 404);
    });
    const client = new Cooper({ apiKey: "coop_live_test", fetch: fetchImpl });
    expect((await client.inboxes.list()).data).toHaveLength(1);
    const sent = await client.messages.send("research-bot", {
      to: ["ada@example.com"],
      subject: "Hello",
      text: "Tuesday works.",
      clientId: "send-1",
      attachments: [{ filename: "note.pdf", content_base64: "YQ==", content_type: "application/pdf" }],
    });
    expect(sent.id).toBe("msg_1");
    const send = calls.find((call) => call.init?.method === "POST");
    expect(send?.url).toBe("https://cooperemail.com/api/v1/inboxes/research-bot/messages");
    expect(JSON.parse(String(send?.init?.body)).client_id).toBe("send-1");
    expect(new Headers(send?.init?.headers).get("authorization")).toBe("Bearer coop_live_test");
    expect((await client.messages.get("inb_1", "msg_1")).extracted_text).toBe("Tuesday works.");
    expect((await client.search("tuesday")).q).toBe("tuesday");
    const file = await client.attachments.download("inb_1", "msg_1", "att_1");
    expect(file.contentType).toBe("application/pdf");
    expect(Array.from(file.bytes)).toEqual([1, 2, 3]);
    const search = calls.find((call) => call.url.includes("/api/v1/search"));
    expect(search?.url).toContain("q=tuesday");
  });

  it("encodes inbox emails and surfaces API errors", async () => {
    const { calls, fetchImpl } = installFetch(() =>
      jsonResponse(
        {
          error: {
            type: "not_found",
            code: "inbox_not_found",
            message: "No such inbox.",
            param: "id",
            docs_url: "https://cooperemail.com/docs#inbox_not_found",
          },
        },
        404,
      ),
    );
    const client = new Cooper({ apiKey: "coop_live_test", fetch: fetchImpl });
    await expect(client.inboxes.get("bot@cooperemail.com")).rejects.toMatchObject({
      name: "CooperApiError",
      code: "inbox_not_found",
      param: "id",
      docsUrl: "https://cooperemail.com/docs#inbox_not_found",
    });
    expect(calls[0]?.url).toBe("https://cooperemail.com/api/v1/inboxes/bot%40cooperemail.com");
  });

  it("groups threads from listed messages", async () => {
    const messages = [
      message("msg_2", "thr_a", "2026-09-18T02:00:00.000Z", "Follow up"),
      message("msg_1", "thr_a", "2026-09-18T01:00:00.000Z", "Hello"),
      message("msg_3", "thr_b", "2026-09-18T00:00:00.000Z", "Other"),
    ];
    expect(groupThreads(messages).map((thread) => thread.id)).toEqual(["thr_a", "thr_b"]);
    expect(groupThreads(messages)[0]).toMatchObject({
      subject: "Follow up",
      message_count: 2,
      latest_at: "2026-09-18T02:00:00.000Z",
    });

    const { fetchImpl } = installFetch(() =>
      jsonResponse({ object: "list", inbox_id: "inb_1", data: messages }),
    );
    const client = new Cooper({ apiKey: "k", fetch: fetchImpl });
    const threads = await client.threads.list("inb_1");
    expect(threads.data).toHaveLength(2);
    await expect(client.threads.get("inb_1", "thr_missing")).rejects.toBeInstanceOf(CooperApiError);
    expect((await client.threads.get("inb_1", "thr_b")).subject).toBe("Other");
  });

  it("registers webhooks and verifies the signature locally", async () => {
    const { calls, fetchImpl } = installFetch(() =>
      jsonResponse({ id: "wh_1", url: "https://example.com/hook", secret: "supersecret" }, 201),
    );
    const client = new Cooper({ apiKey: "coop_live_test", fetch: fetchImpl });
    const hook = await client.webhooks.create({
      url: "https://example.com/hook",
      events: ["message.received"],
      secret: "supersecret",
      inboxId: "inb_1",
      headers: { Authorization: "Bearer secret", "X-Tenant": "acme" },
    });
    expect(hook.id).toBe("wh_1");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      url: "https://example.com/hook",
      events: ["message.received"],
      secret: "supersecret",
      inbox_id: "inb_1",
      headers: { Authorization: "Bearer secret", "X-Tenant": "acme" },
    });

    const payload = JSON.stringify({ id: "evt_1", type: "message.received" });
    const signature = `sha256=${createHmac("sha256", "supersecret").update(payload).digest("hex")}`;
    expect(signWebhookPayload("supersecret", payload)).toBe(signature);
    expect(client.webhooks.verify({ secret: "supersecret", payload, signature })).toBe(true);
    expect(verifyWebhookSignature({ secret: "supersecret", payload, signature: "sha256=nope" })).toBe(false);
    expect(verifyWebhookSignature({ secret: "supersecret", payload, signature: null })).toBe(false);
  });

  it("runs tool calls against the HTTP API", async () => {
    const { calls, fetchImpl } = installFetch((call) => {
      if (call.url.includes("/attachments/")) {
        return new Response(Uint8Array.from([9]), {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      return jsonResponse({ ok: true, url: call.url });
    });
    const client = new Cooper({ apiKey: "coop_live_test", fetch: fetchImpl });
    await executeCooperTool(client, "cooper_send_message", {
      inbox_id: "inb_1",
      to: ["ada@example.com"],
      subject: "Hello",
      text: "Hi",
      client_id: "c1",
    });
    await executeCooperTool(client, "cooper_get_attachment", {
      inbox_id: "inb_1",
      message_id: "msg_1",
      attachment_id: "att_1",
    });
    expect(calls[0]?.url).toContain("/api/v1/inboxes/inb_1/messages");
    expect(calls[1]?.url).toContain("/attachments/att_1");
    const names = COOPER_TOOLS.map((tool) => tool.name);
    expect(names).toContain("cooper_onboard");
    expect(names).toContain("cooper_search");
    expect(names).toContain("cooper_list_threads");
    expect(names).toEqual(
      expect.arrayContaining([
        "cooper_add_owner",
        "cooper_list_owners",
        "cooper_notify_owner",
        "cooper_get_tasks",
        "cooper_reply_task",
      ]),
    );
    await expect(executeCooperTool(client, "cooper_missing", {})).rejects.toMatchObject({
      code: "unknown_tool",
    });
  });

  it("adds an owner, notifies them, long-polls tasks, replies, and marks done", async () => {
    const { calls, fetchImpl } = installFetch((call) => {
      if (call.url.endsWith("/owners") && call.init?.method === "POST") {
        return jsonResponse({ id: "own_1", email: "ada@example.com", status: "pending" }, 201);
      }
      if (call.url.endsWith("/owners")) {
        return jsonResponse({ object: "list", data: [{ id: "own_1", status: "verified" }] });
      }
      if (call.url.endsWith("/api/v1/updates")) {
        return jsonResponse({ id: "upd_1", kind: "needs_input" }, 201);
      }
      if (call.url.includes("/api/v1/tasks?") || call.url.endsWith("/api/v1/tasks")) {
        return jsonResponse({
          object: "list",
          data: [{ id: "tsk_1", text: "Book Acme.", content_trust: "untrusted_data" }],
        });
      }
      if (call.url.endsWith("/reply")) {
        return jsonResponse({ task: { id: "tsk_1", status: "done" }, message: { id: "msg_9" } }, 201);
      }
      if (call.init?.method === "PATCH") {
        return jsonResponse({ id: "tsk_1", status: "done" });
      }
      return jsonResponse({ error: { type: "not_found", code: "missing", message: "no" } }, 404);
    });
    const client = new Cooper({ apiKey: "coop_live_test", fetch: fetchImpl });
    const owner = await client.owners.add("inb_1", { email: "ada@example.com", digest: "immediate" });
    expect(owner.status).toBe("pending");
    expect((await client.owners.list("inb_1")).data[0]?.status).toBe("verified");
    const note = await client.updates.notify({
      inboxId: "inb_1",
      kind: "needs_input",
      text: "Which vendor should I book?",
      taskId: "book-vendor",
      clientId: "ask-1",
    });
    expect(note.kind).toBe("needs_input");
    const tasks = await client.tasks.list({ inboxId: "inb_1", status: "pending", wait: 25 });
    expect(tasks.data[0]?.content_trust).toBe("untrusted_data");
    const reply = await client.tasks.reply("tsk_1", { text: "Booked.", status: "done" });
    expect(reply.task.status).toBe("done");
    expect((await client.tasks.markDone("tsk_1")).status).toBe("done");

    const add = calls.find((call) => call.url.endsWith("/owners") && call.init?.method === "POST");
    expect(JSON.parse(String(add?.init?.body))).toEqual({ email: "ada@example.com", digest: "immediate" });
    const notify = calls.find((call) => call.url.endsWith("/api/v1/updates"));
    expect(JSON.parse(String(notify?.init?.body))).toEqual({
      inbox_id: "inb_1",
      kind: "needs_input",
      text: "Which vendor should I book?",
      task_id: "book-vendor",
      client_id: "ask-1",
    });
    const listed = calls.find((call) => call.url.includes("/api/v1/tasks"));
    expect(listed?.url).toContain("wait=25");
    expect(listed?.url).toContain("status=pending");
    const patched = calls.find((call) => call.init?.method === "PATCH");
    expect(patched?.url).toBe("https://cooperemail.com/api/v1/tasks/tsk_1");
    expect(JSON.parse(String(patched?.init?.body))).toEqual({ status: "done" });

    await executeCooperTool(client, "cooper_notify_owner", {
      inbox_id: "inb_1",
      kind: "done",
      text: "Booked Acme.",
    });
    await executeCooperTool(client, "cooper_get_tasks", { inbox_id: "inb_1", wait: 5 });
    await executeCooperTool(client, "cooper_reply_task", { task_id: "tsk_1", text: "Done.", status: "done" });
  });
});

function message(id: string, threadId: string, createdAt: string, subject: string) {
  return {
    id,
    inbox_id: "inb_1",
    thread_id: threadId,
    direction: "inbound" as const,
    status: "received" as const,
    from: "ada@example.com",
    to: ["research-bot@cooperemail.com"],
    cc: [],
    bcc: [],
    reply_to: null,
    subject,
    text: subject,
    html: null,
    extracted_text: subject,
    extracted_html: "",
    preview: subject,
    in_reply_to: null,
    references: [],
    client_id: null,
    labels: [],
    created_at: createdAt,
    provider: null,
  };
}
