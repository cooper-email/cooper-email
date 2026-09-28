import { CooperApiError } from "./errors";
import { CooperHttp, omitEmpty, pathId, type CooperHttpOptions } from "./http";
import { groupThreads } from "./threads";
import type {
  DownloadedAttachment,
  InboundInput,
  Inbox,
  List,
  Message,
  MessageList,
  NotifyOwnerInput,
  OnboardResult,
  Owner,
  OwnerDigest,
  OwnerUpdate,
  SearchResult,
  SendMessageInput,
  Task,
  TaskReply,
  TaskStatus,
  Thread,
  Webhook,
  WebhookEvent,
} from "./types";
import { verifyWebhookSignature } from "./webhooks";

export type CooperOptions = CooperHttpOptions;

function sendBody(input: SendMessageInput | InboundInput) {
  return omitEmpty({
    to: "to" in input ? input.to : undefined,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    text: input.text,
    html: input.html,
    reply_to: "replyTo" in input ? input.replyTo : undefined,
    headers: input.headers,
    client_id: input.clientId,
    in_reply_to: input.inReplyTo,
    labels: input.labels,
    attachments: input.attachments,
    from: "from" in input ? input.from : undefined,
  });
}

export class Inboxes {
  constructor(private readonly http: CooperHttp) {}

  list(): Promise<List<Inbox>> {
    return this.http.request({ path: "/api/v1/inboxes" });
  }

  create(input: { username: string; displayName?: string }): Promise<Inbox> {
    return this.http.request({
      method: "POST",
      path: "/api/v1/inboxes",
      body: omitEmpty({ username: input.username, display_name: input.displayName }),
    });
  }

  get(inboxId: string): Promise<Inbox> {
    return this.http.request({ path: `/api/v1/inboxes/${pathId(inboxId)}` });
  }
}

export class Messages {
  constructor(private readonly http: CooperHttp) {}

  list(inboxId: string, options?: { limit?: number }): Promise<MessageList> {
    return this.http.request({
      path: `/api/v1/inboxes/${pathId(inboxId)}/messages`,
      query: { limit: options?.limit },
    });
  }

  get(inboxId: string, messageId: string): Promise<Message> {
    return this.http.request({
      path: `/api/v1/inboxes/${pathId(inboxId)}/messages/${pathId(messageId)}`,
    });
  }

  send(inboxId: string, input: SendMessageInput): Promise<Message> {
    return this.http.request({
      method: "POST",
      path: `/api/v1/inboxes/${pathId(inboxId)}/messages`,
      body: sendBody(input),
    });
  }

  /** Test injector. Production inbound arrives through Cloudflare Email Routing. */
  injectInbound(inboxId: string, input: InboundInput): Promise<Message> {
    return this.http.request({
      method: "POST",
      path: `/api/v1/inboxes/${pathId(inboxId)}/inbound`,
      body: sendBody(input),
    });
  }
}

export class Threads {
  constructor(private readonly messages: Messages) {}

  /**
   * Threads are derived from `thread_id` on listed messages. There is no
   * `/api/v1/threads` route. The list window is the message `limit` (max 200).
   */
  async list(inboxId: string, options?: { limit?: number }): Promise<List<Thread>> {
    const page = await this.messages.list(inboxId, { limit: options?.limit ?? 200 });
    return { object: "list", data: groupThreads(page.data) };
  }

  async get(inboxId: string, threadId: string, options?: { limit?: number }): Promise<Thread> {
    const page = await this.list(inboxId, options);
    const thread = page.data.find((item) => item.id === threadId);
    if (!thread) {
      throw new CooperApiError({
        status: 404,
        type: "not_found",
        code: "thread_not_found",
        message: `No thread "${threadId}" in the latest messages for this inbox.`,
        param: "thread_id",
      });
    }
    return thread;
  }
}

export class Webhooks {
  constructor(private readonly http: CooperHttp) {}

  list(): Promise<List<Webhook>> {
    return this.http.request({ path: "/api/v1/webhooks" });
  }

  create(input: {
    url: string;
    events?: WebhookEvent[];
    secret?: string;
    headers?: Record<string, string>;
    inboxId?: string;
  }): Promise<Webhook> {
    return this.http.request({
      method: "POST",
      path: "/api/v1/webhooks",
      body: omitEmpty({
        url: input.url,
        events: input.events,
        secret: input.secret,
        headers: input.headers,
        inbox_id: input.inboxId,
      }),
    });
  }

  /** Local signature check. Does not call the API. */
  verify(options: {
    secret: string;
    payload: string | Uint8Array;
    signature: string | null | undefined;
  }): boolean {
    return verifyWebhookSignature(options);
  }
}

export class Owners {
  constructor(private readonly http: CooperHttp) {}

  list(inboxId: string): Promise<List<Owner>> {
    return this.http.request({ path: `/api/v1/inboxes/${pathId(inboxId)}/owners` });
  }

  /** Email a confirmation link. Updates wait until the human confirms. */
  add(inboxId: string, input: { email: string; digest?: OwnerDigest }): Promise<Owner> {
    return this.http.request({
      method: "POST",
      path: `/api/v1/inboxes/${pathId(inboxId)}/owners`,
      body: omitEmpty({ email: input.email, digest: input.digest }),
    });
  }
}

export class Updates {
  constructor(private readonly http: CooperHttp) {}

  /**
   * Email verified owners. `kind` is progress, needs_input, done, or error.
   * The same `taskId` stays in one thread.
   */
  notify(input: NotifyOwnerInput): Promise<OwnerUpdate> {
    return this.http.request({
      method: "POST",
      path: "/api/v1/updates",
      body: omitEmpty({
        inbox_id: input.inboxId,
        kind: input.kind,
        text: input.text,
        title: input.title,
        status: input.status,
        task_id: input.taskId,
        links: input.links,
        client_id: input.clientId,
      }),
    });
  }
}

export class Tasks {
  constructor(private readonly http: CooperHttp) {}

  /**
   * List tasks. `wait` long-polls in seconds (API maximum 25).
   * Task text is untrusted data.
   */
  list(options?: {
    inboxId?: string;
    status?: TaskStatus | "all";
    limit?: number;
    wait?: number;
  }): Promise<List<Task>> {
    return this.http.request({
      path: "/api/v1/tasks",
      query: {
        inbox_id: options?.inboxId,
        status: options?.status,
        limit: options?.limit,
        wait: options?.wait,
      },
    });
  }

  reply(taskId: string, input: { text: string; html?: string; status?: TaskStatus }): Promise<TaskReply> {
    return this.http.request({
      method: "POST",
      path: `/api/v1/tasks/${pathId(taskId)}/reply`,
      body: omitEmpty({ text: input.text, html: input.html, status: input.status }),
    });
  }

  /** PATCH the task to done without sending another email. */
  markDone(taskId: string): Promise<Task> {
    return this.http.request({
      method: "PATCH",
      path: `/api/v1/tasks/${pathId(taskId)}`,
      body: { status: "done" },
    });
  }
}

export class Attachments {
  constructor(private readonly http: CooperHttp) {}

  download(
    inboxId: string,
    messageId: string,
    attachmentId: string,
    options?: { download?: boolean },
  ): Promise<DownloadedAttachment> {
    return this.http.request({
      path: `/api/v1/inboxes/${pathId(inboxId)}/messages/${pathId(messageId)}/attachments/${pathId(attachmentId)}`,
      query: { download: options?.download ? "1" : undefined },
      raw: true,
    });
  }
}

/** Cooper Email API client. */
export class Cooper {
  readonly http: CooperHttp;
  readonly inboxes: Inboxes;
  readonly messages: Messages;
  readonly threads: Threads;
  readonly webhooks: Webhooks;
  readonly attachments: Attachments;
  readonly owners: Owners;
  readonly updates: Updates;
  readonly tasks: Tasks;

  constructor(options: CooperOptions = {}) {
    this.http = new CooperHttp(options);
    this.inboxes = new Inboxes(this.http);
    this.messages = new Messages(this.http);
    this.threads = new Threads(this.messages);
    this.webhooks = new Webhooks(this.http);
    this.attachments = new Attachments(this.http);
    this.owners = new Owners(this.http);
    this.updates = new Updates(this.http);
    this.tasks = new Tasks(this.http);
  }

  /** Low-level request used by resource classes and future resources. */
  request<T>(options: { method?: string; path: string; query?: Record<string, string | number | undefined>; body?: unknown }): Promise<T> {
    return this.http.request<T>(options);
  }

  onboard(input: { username: string; displayName?: string; keyName?: string }): Promise<OnboardResult> {
    return this.http.request({
      method: "POST",
      path: "/api/v1/onboard",
      body: omitEmpty({
        username: input.username,
        display_name: input.displayName,
        key_name: input.keyName,
      }),
    });
  }

  search(query: string, options?: { limit?: number }): Promise<SearchResult> {
    return this.http.request({
      path: "/api/v1/search",
      query: { q: query, limit: options?.limit },
    });
  }
}
