/** Small fetch helpers for the public Cooper API and the MCP endpoint. */
export const DEFAULT_BASE_URL = "https://cooperemail.com";

const USER_AGENT = "cooper-email-cli";

export class CooperApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

const request = async (
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; headers: Headers; body: unknown; text: string }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, ...(init.headers as Record<string, string>) },
    });
    const text = await response.text();
    let body: unknown = undefined;
    try {
      body = text === "" ? undefined : JSON.parse(text);
    } catch {
      body = undefined;
    }
    return { status: response.status, headers: response.headers, body, text };
  } finally {
    clearTimeout(timer);
  }
};

const errorFrom = (status: number, body: unknown, fallback: string): CooperApiError => {
  const error = (body as { error?: { code?: string; message?: string } } | undefined)?.error;
  return new CooperApiError(error?.message ?? fallback, status, error?.code);
};

export interface UsernameCheck {
  readonly available: boolean;
  readonly reason?: string;
  readonly suggestions?: readonly string[];
}

export const checkUsername = async (baseUrl: string, name: string): Promise<UsernameCheck> => {
  const res = await request(`${baseUrl}/api/v1/usernames/check?name=${encodeURIComponent(name)}`);
  if (res.status !== 200) throw errorFrom(res.status, res.body, `username check failed (HTTP ${res.status})`);
  return res.body as UsernameCheck;
};

export interface OnboardResult {
  readonly api_key: string;
  readonly inbox: { readonly id: string; readonly email: string; readonly username: string };
}

export const onboard = async (
  baseUrl: string,
  input: { username: string; display_name?: string },
): Promise<OnboardResult> => {
  const res = await request(`${baseUrl}/api/v1/onboard`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status < 200 || res.status >= 300)
    throw errorFrom(res.status, res.body, `onboarding failed (HTTP ${res.status})`);
  const result = res.body as OnboardResult;
  if (typeof result?.api_key !== "string" || result.api_key === "")
    throw new CooperApiError("onboarding returned no API key", res.status);
  return result;
};

export interface Me {
  readonly account?: { readonly id?: string };
  readonly [key: string]: unknown;
}

export const whoami = async (baseUrl: string, apiKey: string): Promise<Me> => {
  const res = await request(`${baseUrl}/api/v1/me`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (res.status !== 200) throw errorFrom(res.status, res.body, `key check failed (HTTP ${res.status})`);
  return res.body as Me;
};

/** Read a JSON-RPC response that may come back as JSON or as an SSE stream. */
const rpcBody = (text: string, contentType: string | null): unknown => {
  if (contentType?.includes("text/event-stream")) {
    const data = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line !== "");
    for (const chunk of data) {
      try {
        const parsed = JSON.parse(chunk) as { id?: unknown };
        if (parsed.id !== undefined) return parsed;
      } catch {
        // keep looking
      }
    }
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export interface McpProbe {
  readonly ok: boolean;
  readonly serverName?: string;
  readonly protocolVersion?: string;
  readonly toolCount?: number;
  /** Result of an authenticated cooper_whoami call, when a key was given. */
  readonly authenticated?: boolean;
  readonly error?: string;
}

/** MCP initialize + tools/list (+ cooper_whoami with a key) over Streamable HTTP. */
export const probeMcp = async (url: string, apiKey: string | undefined): Promise<McpProbe> => {
  const baseHeaders: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...(apiKey === undefined ? {} : { authorization: `Bearer ${apiKey}` }),
  };
  let session: string | undefined;
  let protocol: string | undefined;
  const call = async (id: number | undefined, method: string, params?: unknown) => {
    const headers = {
      ...baseHeaders,
      ...(session ? { "mcp-session-id": session } : {}),
      ...(protocol ? { "mcp-protocol-version": protocol } : {}),
    };
    const res = await request(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, ...(params ? { params } : {}) }),
    });
    session = res.headers.get("mcp-session-id") ?? session;
    return { status: res.status, body: rpcBody(res.text, res.headers.get("content-type")) as any };
  };
  try {
    const init = await call(1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: USER_AGENT, version: "1" },
    });
    if (init.status !== 200 || init.body?.result === undefined)
      return { ok: false, error: `initialize failed (HTTP ${init.status})` };
    protocol = init.body.result.protocolVersion;
    await call(undefined, "notifications/initialized");
    const list = await call(2, "tools/list");
    const tools = list.body?.result?.tools;
    if (!Array.isArray(tools)) return { ok: false, error: `tools/list failed (HTTP ${list.status})` };
    let authenticated: boolean | undefined;
    if (apiKey !== undefined) {
      const who = await call(3, "tools/call", { name: "cooper_whoami", arguments: {} });
      authenticated = who.status === 200 && who.body?.result !== undefined && who.body.result.isError !== true;
    }
    return {
      ok: true,
      serverName: init.body.result.serverInfo?.name,
      protocolVersion: protocol,
      toolCount: tools.length,
      ...(authenticated === undefined ? {} : { authenticated }),
    };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  }
};
