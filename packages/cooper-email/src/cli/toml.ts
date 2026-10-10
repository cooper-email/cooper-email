/**
 * Minimal, conservative TOML editing for one server table. Cooper only ever
 * removes and appends its own `[mcp_servers.cooper-email]` table (and its
 * sub-tables); every other line of the file is kept byte for byte.
 */
import { SERVER_NAME } from "./agents.js";

export class TomlEditError extends Error {}

const HEADER = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/;

const normalizeKey = (key: string): string =>
  key
    .split(".")
    .map((part) => part.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"))
    .join(".");

const OWN = `mcp_servers.${SERVER_NAME}`;

const isOwnTable = (header: string): boolean => {
  const key = normalizeKey(header);
  return key === OWN || key.startsWith(`${OWN}.`);
};

/** Reject layouts we will not rewrite safely (inline or dotted definitions of our server). */
const assertNoInlineDefinition = (lines: readonly string[]): void => {
  let table = "";
  for (const line of lines) {
    const header = HEADER.exec(line);
    if (header) {
      table = normalizeKey(header[1]!);
      continue;
    }
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const keyPart = trimmed.split("=")[0]?.trim() ?? "";
    const fullKey = normalizeKey(table === "" ? keyPart : `${table}.${keyPart}`);
    if (!isOwnTable(table) && (fullKey === OWN || fullKey.startsWith(`${OWN}.`)))
      throw new TomlEditError(
        `${SERVER_NAME} is defined inline or with dotted keys; edit that entry by hand or remove it, then rerun.`,
      );
  }
};

/** Split text into lines that are outside our own tables. */
const withoutOwnTables = (text: string): { kept: string[]; found: string[] } => {
  const lines = text.split(/\r?\n/);
  assertNoInlineDefinition(lines);
  const kept: string[] = [];
  const found: string[] = [];
  let inOwn = false;
  let inMultiline: string | undefined;
  for (const line of lines) {
    if (inMultiline === undefined) {
      const header = HEADER.exec(line);
      if (header) {
        const own = isOwnTable(header[1]!);
        if (inOwn && !own) {
          // Comments right above the next table belong to that table.
          const moved: string[] = [];
          while (found.length > 0 && /^\s*(#.*)?$/.test(found[found.length - 1]!))
            moved.unshift(found.pop()!);
          kept.push(...moved);
        }
        inOwn = own;
      }
    }
    // Track multi-line strings so a "[...]" line inside one is not read as a header.
    for (const quote of ['"""', "'''"]) {
      const count = line.split(quote).length - 1;
      if (count % 2 === 1)
        inMultiline = inMultiline === undefined ? quote : inMultiline === quote ? undefined : inMultiline;
    }
    (inOwn ? found : kept).push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1]!.trim() === "") kept.pop();
  return { kept, found };
};

const tomlString = (value: string): string => JSON.stringify(value);

export type TomlDialect = "codex" | "grok";

export const renderTomlBlock = (
  dialect: TomlDialect,
  url: string,
  apiKey: string | undefined,
): string => {
  const lines = [`[mcp_servers.${SERVER_NAME}]`, `url = ${tomlString(url)}`];
  if (apiKey !== undefined) {
    if (dialect === "codex") {
      lines.push("", `[mcp_servers.${SERVER_NAME}.http_headers]`);
      lines.push(`Authorization = ${tomlString(`Bearer ${apiKey}`)}`);
    } else {
      lines.push(`headers = { Authorization = ${tomlString(`Bearer ${apiKey}`)} }`);
    }
  }
  return lines.join("\n");
};

/** Current text of our table(s), or undefined when absent. */
export const readOwnTomlBlock = (text: string): string | undefined => {
  const { found } = withoutOwnTables(text);
  const block = found.join("\n").trim();
  return block === "" ? undefined : block;
};

export const upsertTomlBlock = (text: string, block: string): string => {
  const { kept } = withoutOwnTables(text);
  const head = kept.join("\n");
  return `${head}${head === "" ? "" : "\n\n"}${block}\n`;
};

export const removeTomlBlock = (text: string): string => {
  const { kept } = withoutOwnTables(text);
  return kept.length === 0 ? "" : `${kept.join("\n")}\n`;
};

/** Pull url and Authorization header out of our block for doctor. */
export const parseOwnTomlBlock = (
  block: string,
): { url?: string; authorization?: string } => {
  const url = /^\s*url\s*=\s*"([^"]*)"/m.exec(block)?.[1];
  const authorization = /Authorization\s*=\s*"([^"]*)"/.exec(block)?.[1];
  return {
    ...(url === undefined ? {} : { url }),
    ...(authorization === undefined ? {} : { authorization }),
  };
};
