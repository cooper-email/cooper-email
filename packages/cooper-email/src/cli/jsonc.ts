/** Parse JSON that may contain comments or trailing commas (VS Code, Gemini, OpenCode). */
export interface ParsedJson {
  readonly value: Record<string, unknown>;
  readonly hadComments: boolean;
}

export class ConfigParseError extends Error {}

/** Remove // and /* *\/ comments and trailing commas outside strings. */
export const stripJsonc = (text: string): { text: string; hadComments: boolean } => {
  let out = "";
  let hadComments = false;
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\" && next !== undefined) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      hadComments = true;
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      hadComments = true;
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  // Trailing commas before } or ] (outside strings: re-scan with a simple state machine).
  let result = "";
  inString = false;
  for (let j = 0; j < out.length; j += 1) {
    const ch = out[j]!;
    if (inString) {
      result += ch;
      if (ch === "\\" && j + 1 < out.length) {
        result += out[j + 1];
        j += 1;
      } else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === ",") {
      let k = j + 1;
      while (k < out.length && /\s/.test(out[k]!)) k += 1;
      if (out[k] === "}" || out[k] === "]") {
        hadComments = true;
        continue;
      }
    }
    result += ch;
  }
  return { text: result, hadComments };
};

export const parseJsonConfig = (text: string, allowComments: boolean): ParsedJson => {
  const raw = text.replace(/^\uFEFF/, "");
  if (raw.trim() === "") return { value: {}, hadComments: false };
  const source = allowComments ? stripJsonc(raw) : { text: raw, hadComments: false };
  let value: unknown;
  try {
    value = JSON.parse(source.text);
  } catch (cause) {
    throw new ConfigParseError(
      `not valid JSON${allowComments ? " (comments allowed)" : ""}: ${(cause as Error).message}`,
    );
  }
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new ConfigParseError("top level is not a JSON object");
  return { value: value as Record<string, unknown>, hadComments: source.hadComments };
};
