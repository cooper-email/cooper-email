import { CooperApiError } from "./errors";

export const SDK_VERSION = "0.1.0";
export const DEFAULT_BASE_URL = "https://cooperemail.com";

export type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: string;
  path: string;
  query?: Query;
  body?: unknown;
  raw?: boolean;
};

export type RawResponse = {
  bytes: Uint8Array;
  contentType: string | null;
  contentDisposition: string | null;
};

export type CooperHttpOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export class CooperHttp {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;

  constructor(options: CooperHttpOptions = {}) {
    this.apiKey = options.apiKey || undefined;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>(options: RequestOptions & { raw?: false }): Promise<T>;
  async request(options: RequestOptions & { raw: true }): Promise<RawResponse>;
  async request<T>(options: RequestOptions): Promise<T | RawResponse> {
    const url = new URL(`${this.baseUrl}${options.path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }

    const headers = new Headers();
    headers.set("accept", options.raw ? "*/*" : "application/json");
    headers.set("user-agent", `cooper-email/${SDK_VERSION}`);
    if (this.apiKey) headers.set("authorization", `Bearer ${this.apiKey}`);
    if (options.body !== undefined) headers.set("content-type", "application/json");

    const response = await this.fetchImpl(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!response.ok) {
      throw CooperApiError.fromResponse(response.status, new TextDecoder().decode(bytes));
    }
    if (options.raw) {
      return {
        bytes,
        contentType: response.headers.get("content-type"),
        contentDisposition: response.headers.get("content-disposition"),
      };
    }
    const text = new TextDecoder().decode(bytes);
    if (!text.trim()) return undefined as T;
    return JSON.parse(text) as T;
  }
}

export function pathId(id: string): string {
  return encodeURIComponent(id);
}

export function omitEmpty<T extends Record<string, unknown>>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) out[key as keyof T] = item as T[keyof T];
  }
  return out;
}
