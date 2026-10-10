import { createServer, type IncomingMessage, type Server } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AGENTS, findAgent } from "../src/cli/agents";
import { inspectRegistration, planRegistration, planRemoval } from "../src/cli/config";
import { stripJsonc } from "../src/cli/jsonc";
import { run } from "../src/cli/main";
import type { Io } from "../src/cli/prompt";
import { SKILL_MD } from "../src/cli/skill-content";
import { VERSION } from "../src/cli/version";
import { readOwnTomlBlock, removeTomlBlock, upsertTomlBlock } from "../src/cli/toml";

const KEY = "coop_live_testkey_1234567890abcd";

// --- fake Cooper API + MCP endpoint -------------------------------------------------
let server: Server;
let baseUrl = "";
const calls: string[] = [];
const body = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const auth = req.headers.authorization;
    calls.push(`${req.method} ${url.pathname}`);
    const json = (status: number, value: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(value));
    };
    if (url.pathname === "/api/v1/usernames/check")
      return json(200, { available: url.searchParams.get("name") !== "taken", suggestions: ["taken-2"] });
    if (url.pathname === "/api/v1/onboard" && req.method === "POST") {
      const input = JSON.parse(await body(req));
      return json(201, { api_key: KEY, inbox: { id: "inb_1", username: input.username, email: `${input.username}@cooperemail.com` } });
    }
    if (url.pathname === "/api/v1/me")
      return auth === `Bearer ${KEY}` ? json(200, { account_id: "acct_1" }) : json(401, { error: { code: "invalid_api_key", message: "bad key" } });
    if (url.pathname === "/mcp" && req.method === "POST") {
      const rpc = JSON.parse(await body(req));
      if (rpc.id === undefined) {
        res.writeHead(202);
        return res.end();
      }
      if (rpc.method === "initialize")
        return json(200, { jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: "2025-03-26", serverInfo: { name: "cooper-email" }, capabilities: {} } }, { "mcp-session-id": "s1" });
      if (rpc.method === "tools/list") {
        // Answer as SSE to exercise that path.
        res.writeHead(200, { "content-type": "text/event-stream" });
        return res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: { tools: [{ name: "cooper_whoami" }, { name: "cooper_send_message" }] } })}\n\n`);
      }
      if (rpc.method === "tools/call")
        return auth === `Bearer ${KEY}`
          ? json(200, { jsonrpc: "2.0", id: rpc.id, result: { content: [{ type: "text", text: "{}" }] } })
          : json(200, { jsonrpc: "2.0", id: rpc.id, result: { isError: true, content: [] } });
    }
    json(404, { error: { code: "not_found" } });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// --- helpers -------------------------------------------------------------------------
let home = "";
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "cooper-cli-"));
  calls.length = 0;
});
afterEach(() => rm(home, { recursive: true, force: true }));

const io = (answers: string[] = [], interactive = false): Io & { lines: string[] } => {
  const lines: string[] = [];
  return {
    lines,
    interactive,
    out: (line = "") => lines.push(line),
    err: (line = "") => lines.push(line),
    ask: async (question) => {
      lines.push(question);
      return answers.shift() ?? "";
    },
  };
};

const cli = (argv: string[], options: { env?: Record<string, string>; io?: ReturnType<typeof io> } = {}) => {
  const out = options.io ?? io();
  return run({
    argv: [...argv, "--base-url", baseUrl],
    env: { HOME: home, ...options.env },
    home,
    platform: "linux",
    io: out,
  }).then((code) => ({ code, output: out.lines.join("\n") }));
};

const ctx = () => ({ home, env: { HOME: home }, platform: "linux" as const });
const configOf = (id: string) => findAgent(id)!.configPath(ctx());
const markAll = async () => {
  for (const agent of AGENTS) await mkdir(agent.markers(ctx())[0]!, { recursive: true });
};

// --- tests ---------------------------------------------------------------------------
describe("cooper-email CLI", () => {
  it("bundles the same SKILL.md that skills.sh indexes, and the package version", () => {
    const skill = readFileSync(join(__dirname, "..", "..", "..", "skills", "cooper-email", "SKILL.md"), "utf8");
    expect(SKILL_MD).toBe(skill);
    expect(skill.startsWith("---\nname: cooper-email\ndescription: ")).toBe(true);
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
    expect(VERSION).toBe(pkg.version);
    expect(pkg.bin["cooper-email"]).toBe("./dist/cli.js");
  });

  it("detects nothing in an empty home and says how to pick an agent", async () => {
    const { code, output } = await cli(["setup", "--oauth", "--yes"]);
    expect(code).toBe(1);
    expect(output).toContain("No supported agents found");
  });

  it("dry run lists the plan and writes nothing", async () => {
    await markAll();
    const { code, output } = await cli(["setup", "--api-key", KEY, "--dry-run"]);
    expect(code).toBe(0);
    expect(output).toContain("Dry run");
    expect(output).not.toContain(KEY);
    for (const agent of AGENTS) await expect(stat(agent.configPath(ctx()))).rejects.toThrow();
  });

  it("refuses to apply without a terminal or --yes", async () => {
    await mkdir(join(home, ".cursor"));
    const { code, output } = await cli(["setup", "--api-key", KEY]);
    expect(code).toBe(2);
    expect(output).toContain("--yes");
    await expect(stat(configOf("cursor"))).rejects.toThrow();
  });

  it("asks for approval interactively and cancels on no", async () => {
    await mkdir(join(home, ".cursor"));
    const prompt = io(["n"], true);
    const { code } = await cli(["setup", "--api-key", KEY], { io: prompt });
    expect(code).toBe(1);
    expect(prompt.lines.some((l) => l.includes("Apply these changes?"))).toBe(true);
    await expect(stat(configOf("cursor"))).rejects.toThrow();
  });

  it("writes a valid config for every agent, backs up existing files, and is idempotent", async () => {
    await markAll();
    await writeFile(configOf("claude-code"), JSON.stringify({ numStartups: 4, mcpServers: { other: { command: "x" } } }));
    await writeFile(configOf("codex"), '# keep me\nmodel = "o3"\n\n[mcp_servers.other]\ncommand = "x"\n');
    await writeFile(configOf("gemini"), '{\n  // theme\n  "theme": "dark",\n}\n');

    const first = await cli(["setup", "--api-key", KEY, "--yes"]);
    expect(first.code).toBe(0);

    const json = async (id: string) => JSON.parse(await readFile(configOf(id), "utf8"));
    const auth = { Authorization: `Bearer ${KEY}` };
    const url = `${baseUrl}/mcp`;
    expect((await json("claude-code")).mcpServers).toEqual({ other: { command: "x" }, "cooper-email": { type: "http", url, headers: auth } });
    expect((await json("claude-code")).numStartups).toBe(4);
    expect((await json("cursor")).mcpServers["cooper-email"]).toEqual({ url, headers: auth });
    expect(await json("gemini")).toEqual({ theme: "dark", mcpServers: { "cooper-email": { httpUrl: url, headers: auth } } });
    expect((await json("windsurf")).mcpServers["cooper-email"]).toEqual({ serverUrl: url, headers: auth });
    expect((await json("devin")).mcpServers["cooper-email"]).toEqual({ serverUrl: url, headers: auth });
    expect((await json("vscode")).servers["cooper-email"]).toEqual({ type: "http", url, headers: auth });
    expect(await json("opencode")).toEqual({
      $schema: "https://opencode.ai/config.json",
      mcp: { "cooper-email": { type: "remote", url, enabled: true, headers: auth } },
    });
    expect((await json("copilot")).mcpServers["cooper-email"]).toEqual({ type: "http", url, headers: auth, tools: ["*"] });
    expect((await json("claude-desktop")).mcpServers["cooper-email"]).toEqual({
      command: "npx",
      args: ["-y", "mcp-remote@latest", url, "--header", "Authorization:${COOPER_AUTH_HEADER}"],
      env: { COOPER_AUTH_HEADER: `Bearer ${KEY}` },
    });

    const codexText = await readFile(configOf("codex"), "utf8");
    expect(codexText.startsWith('# keep me\nmodel = "o3"\n')).toBe(true);
    expect(parseToml(codexText)).toEqual({
      model: "o3",
      mcp_servers: { other: { command: "x" }, "cooper-email": { url, http_headers: auth } },
    });
    expect(parseToml(await readFile(configOf("grok"), "utf8"))).toEqual({
      mcp_servers: { "cooper-email": { url, headers: auth } },
    });

    // Backups hold the original bytes.
    expect(await readFile(`${configOf("codex")}.cooper-email.bak`, "utf8")).toContain("# keep me");
    expect(await readFile(`${configOf("gemini")}.cooper-email.bak`, "utf8")).toContain("// theme");
    // Skills installed in the shared and Claude Code roots.
    expect(await readFile(join(home, ".agents", "skills", "cooper-email", "SKILL.md"), "utf8")).toBe(SKILL_MD);
    expect(await readFile(join(home, ".claude", "skills", "cooper-email", "SKILL.md"), "utf8")).toBe(SKILL_MD);
    // Key saved privately.
    const creds = join(home, ".config", "cooper-email", "credentials.json");
    expect(JSON.parse(await readFile(creds, "utf8")).api_key).toBe(KEY);
    expect((await stat(creds)).mode & 0o777).toBe(0o600);
    expect((await stat(configOf("cursor"))).mode & 0o777).toBe(0o600);

    const second = await cli(["setup", "--yes"]);
    expect(second.code).toBe(0);
    expect(second.output).toContain("Everything is already set up");
    const backups = (await readdir(join(home, ".codex"))).filter((f) => f.includes(".bak"));
    expect(backups).toHaveLength(1);
  });

  it("creates an inbox through onboarding only after approval", async () => {
    await mkdir(join(home, ".codex"));
    const prompt = io(["my-agent", "y"], true);
    const { code, output } = await cli(["setup"], { io: prompt });
    expect(code).toBe(0);
    expect(calls).toContain("GET /api/v1/usernames/check");
    expect(calls.indexOf("POST /api/v1/onboard")).toBeGreaterThan(-1);
    expect(output).toContain("my-agent@cooperemail.com");
    expect(output).not.toContain(KEY);
    const toml = parseToml(await readFile(configOf("codex"), "utf8")) as any;
    expect(toml.mcp_servers["cooper-email"].http_headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("stops before onboarding when the username is taken", async () => {
    await mkdir(join(home, ".codex"));
    const { code, output } = await cli(["setup", "--username", "taken", "--yes"]);
    expect(code).toBe(1);
    expect(output).toContain("not available");
    expect(calls).not.toContain("POST /api/v1/onboard");
  });

  it("rejects a key Cooper does not accept", async () => {
    await mkdir(join(home, ".cursor"));
    const { code, output } = await cli(["setup", "--api-key", "coop_live_wrong_000000000", "--yes"]);
    expect(code).toBe(1);
    expect(output).toContain("rejected");
  });

  it("needs a key source when not interactive", async () => {
    await mkdir(join(home, ".cursor"));
    const { code, output } = await cli(["setup", "--yes"]);
    expect(code).toBe(1);
    expect(output).toContain("--oauth");
  });

  it("--oauth registers without headers", async () => {
    await mkdir(join(home, ".cursor"));
    const { code } = await cli(["setup", "--oauth", "--yes", "--no-skill"]);
    expect(code).toBe(0);
    expect(JSON.parse(await readFile(configOf("cursor"), "utf8")).mcpServers["cooper-email"]).toEqual({ url: `${baseUrl}/mcp` });
    await expect(stat(join(home, ".agents"))).rejects.toThrow();
  });

  it("doctor checks registrations, the key, and MCP initialize + tools/list", async () => {
    await mkdir(join(home, ".cursor"));
    await mkdir(join(home, ".codex"));
    await cli(["setup", "--api-key", KEY, "--yes"]);
    const ok = await cli(["doctor", "--json"]);
    expect(ok.code).toBe(0);
    const report = JSON.parse(ok.output);
    expect(report.ok).toBe(true);
    expect(report.live.mcp).toMatchObject({ ok: true, toolCount: 2, authenticated: true });
    expect(ok.output).not.toContain(KEY);
    expect(calls).toEqual(expect.arrayContaining(["POST /mcp", "GET /api/v1/me"]));

    await writeFile(configOf("cursor"), "{ not json");
    const bad = await cli(["doctor"]);
    expect(bad.code).toBe(1);
    expect(bad.output).toContain("could not be read");
  });

  it("uninstall removes only Cooper entries and skills, keeping backups and the key", async () => {
    await mkdir(join(home, ".codex"));
    await mkdir(join(home, ".claude"));
    await writeFile(configOf("claude-code"), JSON.stringify({ keep: true, mcpServers: { other: { command: "x" } } }));
    await writeFile(configOf("codex"), '[mcp_servers.other]\ncommand = "x"\n');
    await cli(["setup", "--api-key", KEY, "--yes"]);
    const { code } = await cli(["uninstall", "--yes"]);
    expect(code).toBe(0);
    expect(JSON.parse(await readFile(configOf("claude-code"), "utf8"))).toEqual({ keep: true, mcpServers: { other: { command: "x" } } });
    expect(parseToml(await readFile(configOf("codex"), "utf8"))).toEqual({ mcp_servers: { other: { command: "x" } } });
    await expect(stat(join(home, ".agents", "skills", "cooper-email"))).rejects.toThrow();
    await expect(stat(join(home, ".claude", "skills", "cooper-email"))).rejects.toThrow();
    await stat(join(home, ".config", "cooper-email", "credentials.json"));
    const again = await cli(["uninstall", "--yes"]);
    expect(again.output).toContain("Nothing to remove");
  });

  it("rejects unknown agents and options", async () => {
    expect((await cli(["setup", "--agent", "nope"])).output).toContain('unknown agent "nope"');
    expect((await cli(["setup", "--bogus"])).output).toContain("unknown option");
  });
});

describe("config editing", () => {
  const codex = findAgent("codex")!;
  const reg = { url: "https://cooperemail.com/mcp", apiKey: KEY };

  it("replaces an existing cooper table and its sub-tables but keeps comments for the next table", () => {
    const text = [
      'model = "o3"',
      "",
      "[mcp_servers.cooper-email]",
      'url = "https://old.example/mcp"',
      "",
      "[mcp_servers.cooper-email.http_headers]",
      'Authorization = "Bearer old"',
      "",
      "# notes for other",
      "[mcp_servers.other]",
      'command = "x"',
      "",
    ].join("\n");
    const edit = planRegistration(codex, text, reg);
    expect(edit.kind).toBe("update");
    const parsed = parseToml(edit.content!) as any;
    expect(parsed.mcp_servers["cooper-email"]).toEqual({ url: reg.url, http_headers: { Authorization: `Bearer ${KEY}` } });
    expect(parsed.mcp_servers.other).toEqual({ command: "x" });
    expect(edit.content).toContain("# notes for other\n[mcp_servers.other]");
    expect(planRegistration(codex, edit.content, reg).kind).toBe("unchanged");
    expect(inspectRegistration(codex, edit.content!)).toEqual({ present: true, url: reg.url, apiKey: KEY });
  });

  it("refuses inline or dotted definitions it cannot rewrite safely", () => {
    expect(() => planRegistration(codex, 'mcp_servers.cooper-email.url = "x"\n', reg)).toThrow(/inline or with dotted keys/);
    expect(() => planRegistration(codex, '[mcp_servers]\n"cooper-email" = { url = "x" }\n', reg)).toThrow(/inline/);
  });

  it("does not treat brackets inside multi-line strings as tables", () => {
    const text = 'instructions = """\n[mcp_servers.cooper-email]\n"""\n';
    expect(readOwnTomlBlock(text)).toBeUndefined();
    const next = upsertTomlBlock(text, '[mcp_servers.cooper-email]\nurl = "u"');
    expect((parseToml(next) as any).instructions).toBe("[mcp_servers.cooper-email]\n");
    expect(removeTomlBlock(next)).toBe(text);
  });

  it("reports malformed JSON instead of overwriting it", () => {
    expect(() => planRegistration(findAgent("cursor")!, "{ nope", reg)).toThrow(/not valid JSON/);
    expect(() => planRegistration(findAgent("cursor")!, '{"mcpServers": []}', reg)).toThrow(/not an object/);
  });

  it("strips JSONC comments and trailing commas but not inside strings", () => {
    const { text, hadComments } = stripJsonc('{"a": "http://x//y", /* c */ "b": [1,2,],}');
    expect(hadComments).toBe(true);
    expect(JSON.parse(text)).toEqual({ a: "http://x//y", b: [1, 2] });
  });

  it("planRemoval returns undefined when not registered", () => {
    expect(planRemoval(findAgent("cursor")!, '{"mcpServers":{}}')).toBeUndefined();
    expect(planRemoval(codex, '[mcp_servers.other]\ncommand = "x"\n')).toBeUndefined();
  });
});
