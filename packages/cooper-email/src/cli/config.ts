import { SERVER_NAME, type AgentDefinition, type ConfigFormat } from "./agents.js";
import { ConfigParseError, parseJsonConfig } from "./jsonc.js";
import {
  TomlEditError,
  parseOwnTomlBlock,
  readOwnTomlBlock,
  removeTomlBlock,
  renderTomlBlock,
  upsertTomlBlock,
} from "./toml.js";

export interface Registration {
  readonly url: string;
  /** API key to send as a Bearer token. Undefined means the agent signs in with OAuth. */
  readonly apiKey?: string;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const authHeaders = (apiKey: string | undefined): Json =>
  apiKey === undefined ? {} : { headers: { Authorization: `Bearer ${apiKey}` } };

/** The JSON container key and the server entry for each JSON-based agent. */
export const jsonEntry = (
  format: Exclude<ConfigFormat, "codex" | "grok">,
  { url, apiKey }: Registration,
): { container: string; entry: Json } => {
  switch (format) {
    case "claude_code":
      return { container: "mcpServers", entry: { type: "http", url, ...authHeaders(apiKey) } };
    case "cursor":
      return { container: "mcpServers", entry: { url, ...authHeaders(apiKey) } };
    case "gemini":
      return { container: "mcpServers", entry: { httpUrl: url, ...authHeaders(apiKey) } };
    case "windsurf":
      return { container: "mcpServers", entry: { serverUrl: url, ...authHeaders(apiKey) } };
    case "vscode":
      return { container: "servers", entry: { type: "http", url, ...authHeaders(apiKey) } };
    case "opencode":
      return {
        container: "mcp",
        entry: { type: "remote", url, enabled: true, ...authHeaders(apiKey) },
      };
    case "copilot":
      return {
        container: "mcpServers",
        entry: { type: "http", url, ...authHeaders(apiKey), tools: ["*"] },
      };
    case "claude_desktop":
      return {
        container: "mcpServers",
        entry: {
          command: "npx",
          args: [
            "-y",
            "mcp-remote@latest",
            url,
            ...(apiKey === undefined ? [] : ["--header", "Authorization:${COOPER_AUTH_HEADER}"]),
          ],
          ...(apiKey === undefined ? {} : { env: { COOPER_AUTH_HEADER: `Bearer ${apiKey}` } }),
        },
      };
  }
};

const allowsComments = (format: ConfigFormat): boolean =>
  format === "vscode" || format === "opencode" || format === "gemini";

const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    isObject(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  );

export type ChangeKind = "create" | "update" | "unchanged";

export interface PlannedEdit {
  readonly kind: ChangeKind;
  /** Full new file content (only for create/update). */
  readonly content?: string;
  readonly warnings: readonly string[];
}

export class ConfigError extends Error {}

/** Compute the edited file content for a registration. `original` undefined = file absent. */
export const planRegistration = (
  agent: AgentDefinition,
  original: string | undefined,
  registration: Registration,
): PlannedEdit => {
  if (agent.format === "codex" || agent.format === "grok") {
    const text = original ?? "";
    const block = renderTomlBlock(agent.format, registration.url, registration.apiKey);
    try {
      const current = readOwnTomlBlock(text);
      if (current === block) return { kind: "unchanged", warnings: [] };
      return {
        kind: current === undefined ? "create" : "update",
        content: upsertTomlBlock(text, block),
        warnings: [],
      };
    } catch (cause) {
      if (cause instanceof TomlEditError) throw new ConfigError(cause.message);
      throw cause;
    }
  }
  const warnings: string[] = [];
  let parsed: Json;
  try {
    const result = parseJsonConfig(original ?? "", allowsComments(agent.format));
    parsed = result.value;
    if (result.hadComments)
      warnings.push("comments and trailing commas in this file will be removed (a backup is kept)");
  } catch (cause) {
    if (cause instanceof ConfigParseError)
      throw new ConfigError(`config is ${cause.message}; fix it, then rerun`);
    throw cause;
  }
  const { container, entry } = jsonEntry(agent.format, registration);
  const servers = parsed[container];
  if (servers !== undefined && !isObject(servers))
    throw new ConfigError(`"${container}" is not an object; fix it, then rerun`);
  const existing = servers?.[SERVER_NAME];
  if (existing !== undefined && stableStringify(existing) === stableStringify(entry))
    return { kind: "unchanged", warnings };
  const next: Json = { ...parsed };
  if (agent.format === "opencode" && original === undefined)
    next.$schema = "https://opencode.ai/config.json";
  next[container] = { ...(servers ?? {}), [SERVER_NAME]: entry };
  return {
    kind: existing === undefined ? "create" : "update",
    content: `${JSON.stringify(next, null, 2)}\n`,
    warnings,
  };
};

/** Content with our entry removed, or undefined when nothing to remove. */
export const planRemoval = (agent: AgentDefinition, original: string): string | undefined => {
  if (agent.format === "codex" || agent.format === "grok") {
    try {
      if (readOwnTomlBlock(original) === undefined) return undefined;
      return removeTomlBlock(original);
    } catch (cause) {
      if (cause instanceof TomlEditError) throw new ConfigError(cause.message);
      throw cause;
    }
  }
  let parsed: Json;
  try {
    parsed = parseJsonConfig(original, allowsComments(agent.format)).value;
  } catch (cause) {
    if (cause instanceof ConfigParseError) throw new ConfigError(`config is ${cause.message}`);
    throw cause;
  }
  const { container } = jsonEntry(agent.format, { url: "" });
  const servers = parsed[container];
  if (!isObject(servers) || !(SERVER_NAME in servers)) return undefined;
  const { [SERVER_NAME]: _removed, ...rest } = servers;
  const next: Json = { ...parsed, [container]: rest };
  return `${JSON.stringify(next, null, 2)}\n`;
};

export interface InspectedRegistration {
  readonly present: boolean;
  readonly url?: string;
  readonly apiKey?: string;
  readonly oauth?: boolean;
}

/** Read our registration back out of a config file (for doctor). */
export const inspectRegistration = (
  agent: AgentDefinition,
  original: string,
): InspectedRegistration => {
  const bearer = (value: string | undefined): string | undefined =>
    value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : undefined;
  if (agent.format === "codex" || agent.format === "grok") {
    const block = readOwnTomlBlock(original);
    if (block === undefined) return { present: false };
    const { url, authorization } = parseOwnTomlBlock(block);
    const apiKey = bearer(authorization);
    return { present: true, ...(url ? { url } : {}), ...(apiKey ? { apiKey } : { oauth: true }) };
  }
  const parsed = parseJsonConfig(original, allowsComments(agent.format)).value;
  const { container } = jsonEntry(agent.format, { url: "" });
  const servers = parsed[container];
  const entry = isObject(servers) ? servers[SERVER_NAME] : undefined;
  if (!isObject(entry)) return { present: false };
  if (agent.format === "claude_desktop") {
    const args = Array.isArray(entry.args) ? entry.args.map(String) : [];
    const url = args.find((arg) => /^https?:\/\//.test(arg));
    const env = isObject(entry.env) ? entry.env : {};
    const apiKey = bearer(typeof env.COOPER_AUTH_HEADER === "string" ? env.COOPER_AUTH_HEADER : undefined);
    return { present: true, ...(url ? { url } : {}), ...(apiKey ? { apiKey } : { oauth: true }) };
  }
  const url = [entry.url, entry.httpUrl, entry.serverUrl].find(
    (value): value is string => typeof value === "string",
  );
  const headers = isObject(entry.headers) ? entry.headers : {};
  const auth = headers.Authorization ?? headers.authorization;
  const apiKey = bearer(typeof auth === "string" ? auth : undefined);
  return { present: true, ...(url ? { url } : {}), ...(apiKey ? { apiKey } : { oauth: true }) };
};
