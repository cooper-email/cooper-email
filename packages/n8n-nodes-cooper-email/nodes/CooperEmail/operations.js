const OPERATIONS = {
  onboard: {
    method: "POST",
    auth: false,
    path: () => "/api/v1/onboard",
    body: (params) => ({
      username: params.username,
      display_name: params.displayName || undefined,
      key_name: params.keyName || undefined,
    }),
  },
  createInbox: {
    method: "POST",
    auth: true,
    path: () => "/api/v1/inboxes",
    body: (params) => ({ username: params.username, display_name: params.displayName || undefined }),
  },
  listInboxes: { method: "GET", auth: true, path: () => "/api/v1/inboxes" },
  send: {
    method: "POST",
    auth: true,
    path: (params) => `/api/v1/inboxes/${encodeURIComponent(params.inboxId)}/messages`,
    body: (params) => ({
      to: splitList(params.to),
      subject: params.subject,
      text: params.text || undefined,
      html: params.html || undefined,
      client_id: params.clientId || undefined,
    }),
  },
  listMessages: {
    method: "GET",
    auth: true,
    path: (params) => `/api/v1/inboxes/${encodeURIComponent(params.inboxId)}/messages`,
    query: (params) => ({ limit: params.limit || undefined }),
  },
  getMessage: {
    method: "GET",
    auth: true,
    path: (params) =>
      `/api/v1/inboxes/${encodeURIComponent(params.inboxId)}/messages/${encodeURIComponent(params.messageId)}`,
  },
  search: {
    method: "GET",
    auth: true,
    path: () => "/api/v1/search",
    query: (params) => ({ q: params.q, limit: params.limit || undefined }),
  },
  registerWebhook: {
    method: "POST",
    auth: true,
    path: () => "/api/v1/webhooks",
    body: (params) => ({
      url: params.url,
      secret: params.secret || undefined,
      events: params.events ? splitList(params.events) : undefined,
    }),
  },
  downloadAttachment: {
    method: "GET",
    auth: true,
    path: (params) =>
      `/api/v1/inboxes/${encodeURIComponent(params.inboxId)}/messages/${encodeURIComponent(params.messageId)}/attachments/${encodeURIComponent(params.attachmentId)}`,
  },
  addOwner: {
    method: "POST",
    auth: true,
    path: (params) => `/api/v1/inboxes/${encodeURIComponent(params.inboxId)}/owners`,
    body: (params) => ({
      email: params.email,
      digest: params.digest || undefined,
    }),
  },
  listOwners: {
    method: "GET",
    auth: true,
    path: (params) => `/api/v1/inboxes/${encodeURIComponent(params.inboxId)}/owners`,
  },
  notifyOwner: {
    method: "POST",
    auth: true,
    path: () => "/api/v1/updates",
    body: (params) => ({
      inbox_id: params.inboxId,
      kind: params.kind,
      text: params.text,
      title: params.title || undefined,
      task_id: params.taskId || undefined,
      client_id: params.clientId || undefined,
    }),
  },
  getTasks: {
    method: "GET",
    auth: true,
    path: () => "/api/v1/tasks",
    query: (params) => ({
      inbox_id: params.inboxId || undefined,
      status: params.status || undefined,
      limit: params.limit || undefined,
      wait: params.wait || undefined,
    }),
  },
  replyTask: {
    method: "POST",
    auth: true,
    path: (params) => `/api/v1/tasks/${encodeURIComponent(params.taskId)}/reply`,
    body: (params) => ({
      text: params.text,
      status: params.status || undefined,
    }),
  },
  markTaskDone: {
    method: "PATCH",
    auth: true,
    path: (params) => `/api/v1/tasks/${encodeURIComponent(params.taskId)}`,
    body: () => ({ status: "done" }),
  },
};

function splitList(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function definedBody(body) {
  if (!body) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function buildCooperRequest({ baseUrl, apiKey, operation, params }) {
  const spec = OPERATIONS[operation];
  if (!spec) {
    throw new Error(`Unknown Cooper Email operation "${operation}".`);
  }
  const root = String(baseUrl || "https://cooperemail.com").replace(/\/$/, "");
  const url = new URL(root + spec.path(params || {}));
  const query = spec.query ? spec.query(params || {}) : {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const headers = {
    accept: "application/json",
    "user-agent": "n8n-nodes-cooper-email/0.1.0",
  };
  if (spec.auth && apiKey) headers.authorization = `Bearer ${apiKey}`;
  const body = definedBody(spec.body ? spec.body(params || {}) : undefined);
  if (body) headers["content-type"] = "application/json";
  return {
    method: spec.method,
    url: url.toString(),
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };
}

async function cooperFetch(options, fetchImpl = globalThis.fetch) {
  const request = buildCooperRequest(options);
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message ? payload.error.message : text;
    const error = new Error(message || `Cooper Email returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

module.exports = { OPERATIONS, buildCooperRequest, cooperFetch };
