import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { AGENTS, SERVER_NAME, agentIds, findAgent, type AgentDefinition, type PathContext } from "./agents.js";
import { CooperApiError, DEFAULT_BASE_URL, checkUsername, onboard, probeMcp, whoami } from "./api.js";
import { ConfigError, inspectRegistration, planRegistration, planRemoval } from "./config.js";
import { backup, exists, readOptional, removeDir, writeAtomic } from "./files.js";
import { confirm, systemIo, type Io } from "./prompt.js";
import { SKILL_MD } from "./skill-content.js";
import { VERSION } from "./version.js";

const SKILL_DIR = "cooper-email";

interface Options {
  yes: boolean;
  dryRun: boolean;
  json: boolean;
  agents: string[];
  apiKey?: string;
  username?: string;
  displayName?: string;
  oauth: boolean;
  skill: boolean;
  baseUrl: string;
  offline: boolean;
  removeCredentials: boolean;
  help: boolean;
}

export interface RunContext {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly home?: string;
  readonly platform?: NodeJS.Platform;
  readonly io?: Io;
}

const HELP = `cooper-email ${VERSION}: connect your coding agents to Cooper Email (https://cooperemail.com)

Usage:
  npx cooper-email setup       Register Cooper's MCP server with your agents and install the skill
  npx cooper-email doctor      Check registrations, the API key, and the live MCP connection
  npx cooper-email uninstall   Remove what setup added (backups are kept)

Options:
  -y, --yes                 Apply without asking (required when not running in a terminal)
  --dry-run                 Show the plan and change nothing
  --agent <id>              Only this agent; repeat or comma-separate. Default: every detected agent
                            (${agentIds().join(", ")})
  --api-key <key>           Use an existing key (or set COOPER_API_KEY)
  --username <name>         Create a new inbox <name>@cooperemail.com and API key during setup
  --display-name <name>     From name for the new inbox
  --oauth                   Register without a key; each agent signs in with OAuth on first use
  --no-skill                Do not install the Cooper skill
  --offline                 doctor: skip network checks
  --remove-credentials      uninstall: also delete the saved key file
  --json                    Machine-readable output (setup with --dry-run or --yes, doctor)
  -h, --help                Show help
  -v, --version             Show version

Setup shows every file it will change and asks before writing. Each existing
config is backed up next to itself as <file>.cooper-email.bak first.
Docs: https://cooperemail.com/docs/mcp`;

class UsageError extends Error {}

export const parseArgs = (argv: readonly string[], env: RunContext["env"]): { command?: string; options: Options } => {
  const options: Options = {
    yes: false,
    dryRun: false,
    json: false,
    agents: [],
    oauth: false,
    skill: true,
    baseUrl: (env.COOPER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    offline: false,
    removeCredentials: false,
    help: false,
  };
  let command: string | undefined;
  const takeValue = (flag: string, args: string[], inline?: string): string => {
    const value = inline ?? args.shift();
    if (value === undefined || value === "" || (inline === undefined && value.startsWith("-")))
      throw new UsageError(`${flag} needs a value`);
    return value;
  };
  const args = [...argv];
  while (args.length > 0) {
    const raw = args.shift()!;
    const eq = raw.startsWith("--") ? raw.indexOf("=") : -1;
    const flag = eq === -1 ? raw : raw.slice(0, eq);
    const inline = eq === -1 ? undefined : raw.slice(eq + 1);
    switch (flag) {
      case "-y":
      case "--yes":
        options.yes = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--agent":
      case "--client":
        options.agents.push(...takeValue(flag, args, inline).split(",").map((s) => s.trim()).filter(Boolean));
        break;
      case "--api-key":
        options.apiKey = takeValue(flag, args, inline);
        break;
      case "--username":
        options.username = takeValue(flag, args, inline);
        break;
      case "--display-name":
        options.displayName = takeValue(flag, args, inline);
        break;
      case "--base-url":
        options.baseUrl = takeValue(flag, args, inline).replace(/\/+$/, "");
        break;
      case "--oauth":
        options.oauth = true;
        break;
      case "--no-skill":
        options.skill = false;
        break;
      case "--offline":
        options.offline = true;
        break;
      case "--remove-credentials":
        options.removeCredentials = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "-v":
      case "--version":
        command = command ?? "version";
        break;
      default:
        if (raw.startsWith("-")) throw new UsageError(`unknown option ${raw}`);
        if (command !== undefined) throw new UsageError(`unexpected argument ${raw}`);
        command = raw;
    }
  }
  for (const id of options.agents)
    if (findAgent(id) === undefined)
      throw new UsageError(`unknown agent "${id}". Supported: ${agentIds().join(", ")}`);
  if (options.oauth && (options.apiKey !== undefined || options.username !== undefined))
    throw new UsageError("--oauth cannot be combined with --api-key or --username");
  if (options.apiKey !== undefined && options.username !== undefined)
    throw new UsageError("use either --api-key or --username, not both");
  return { command, options };
};

export const redact = (key: string): string =>
  key.length <= 14 ? "coop_…" : `${key.slice(0, 10)}…${key.slice(-4)}`;

const credentialsPath = (ctx: PathContext): string =>
  join(ctx.env.XDG_CONFIG_HOME || join(ctx.home, ".config"), "cooper-email", "credentials.json");

interface SavedCredentials {
  api_key: string;
  inbox?: string;
  base_url?: string;
  created_at?: string;
}

const readCredentials = async (ctx: PathContext): Promise<SavedCredentials | undefined> => {
  const text = await readOptional(credentialsPath(ctx));
  if (text === undefined) return undefined;
  try {
    const parsed = JSON.parse(text) as SavedCredentials;
    return typeof parsed.api_key === "string" && parsed.api_key !== "" ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const detectAgents = async (ctx: PathContext): Promise<AgentDefinition[]> => {
  const found: AgentDefinition[] = [];
  for (const agent of AGENTS) {
    for (const marker of agent.markers(ctx))
      if (await exists(marker)) {
        found.push(agent);
        break;
      }
  }
  return found;
};

const selectAgents = async (ctx: PathContext, options: Options): Promise<AgentDefinition[]> =>
  options.agents.length > 0
    ? options.agents.map((id) => findAgent(id)!).filter((a, i, all) => all.indexOf(a) === i)
    : detectAgents(ctx);

const skillTargets = (ctx: PathContext, agents: readonly AgentDefinition[]): string[] => {
  const roots = new Set<string>();
  for (const agent of agents) for (const root of agent.skillRoots(ctx)) roots.add(root);
  return [...roots].sort().map((root) => join(root, SKILL_DIR));
};

interface ConfigAction {
  readonly type: "config";
  readonly agent: AgentDefinition;
  readonly path: string;
  readonly kind: "create" | "update";
  readonly fileExists: boolean;
  readonly content: string;
  readonly warnings: readonly string[];
  backupPath?: string;
}

interface SkillAction {
  readonly type: "skill";
  readonly path: string;
  readonly kind: "create" | "update";
}

type KeySource =
  | { kind: "flag" | "env" | "saved"; apiKey: string }
  | { kind: "onboard"; username: string; displayName?: string }
  | { kind: "oauth" };

const describeKey = (source: KeySource): string => {
  switch (source.kind) {
    case "flag":
      return `API key from --api-key (${redact(source.apiKey)})`;
    case "env":
      return `API key from COOPER_API_KEY (${redact(source.apiKey)})`;
    case "saved":
      return `saved API key (${redact(source.apiKey)})`;
    case "onboard":
      return `new inbox ${source.username}@cooperemail.com and API key (POST /api/v1/onboard)`;
    case "oauth":
      return "no key: each agent signs in with OAuth in the browser on first use";
  }
};

const resolveKeySource = async (
  ctx: PathContext,
  options: Options,
  io: Io,
): Promise<KeySource> => {
  if (options.oauth) return { kind: "oauth" };
  if (options.apiKey !== undefined) return { kind: "flag", apiKey: options.apiKey };
  if (options.username !== undefined)
    return { kind: "onboard", username: options.username, ...(options.displayName ? { displayName: options.displayName } : {}) };
  const envKey = ctx.env.COOPER_API_KEY;
  if (envKey !== undefined && envKey !== "") return { kind: "env", apiKey: envKey };
  const saved = await readCredentials(ctx);
  if (saved !== undefined) return { kind: "saved", apiKey: saved.api_key };
  if (!io.interactive || options.yes)
    throw new UsageError(
      "no Cooper API key found. Pass --username <name> to create an inbox, --api-key <key> (or COOPER_API_KEY) to use one, or --oauth to sign in from each agent.",
    );
  io.out("No Cooper API key found.");
  io.out("Setup can create a free inbox (<name>@cooperemail.com) and an API key now.");
  const name = await io.ask("Inbox name to create (leave empty to use OAuth sign-in instead): ");
  if (name === "") return { kind: "oauth" };
  return { kind: "onboard", username: name };
};

const plan = async (
  ctx: PathContext,
  agents: readonly AgentDefinition[],
  registration: { url: string; apiKey?: string },
  includeSkill: boolean,
): Promise<{ actions: (ConfigAction | SkillAction)[]; unchanged: string[]; errors: string[] }> => {
  const actions: (ConfigAction | SkillAction)[] = [];
  const unchanged: string[] = [];
  const errors: string[] = [];
  for (const agent of agents) {
    const path = agent.configPath(ctx);
    const original = await readOptional(path);
    try {
      const edit = planRegistration(agent, original, registration);
      if (edit.kind === "unchanged" || edit.content === undefined) unchanged.push(`${agent.name}: ${path}`);
      else
        actions.push({
          type: "config",
          agent,
          path,
          kind: edit.kind,
          fileExists: original !== undefined,
          content: edit.content,
          warnings: edit.warnings,
        });
    } catch (cause) {
      if (cause instanceof ConfigError) errors.push(`${agent.name}: ${path}: ${cause.message}`);
      else throw cause;
    }
  }
  if (includeSkill)
    for (const dir of skillTargets(ctx, agents)) {
      const current = await readOptional(join(dir, "SKILL.md"));
      if (current === SKILL_MD) unchanged.push(`skill: ${join(dir, "SKILL.md")}`);
      else actions.push({ type: "skill", path: join(dir, "SKILL.md"), kind: current === undefined ? "create" : "update" });
    }
  return { actions, unchanged, errors };
};

const runSetup = async (ctx: PathContext, options: Options, io: Io): Promise<number> => {
  const agents = await selectAgents(ctx, options);
  if (agents.length === 0) {
    io.err("No supported agents found in this home directory.");
    io.err(`Pick one explicitly with --agent (${agentIds().join(", ")}).`);
    return 1;
  }
  if (options.json && !options.dryRun && !options.yes) throw new UsageError("--json needs --dry-run or --yes");
  const mcpUrl = `${options.baseUrl}/mcp`;
  const source = await resolveKeySource(ctx, options, io);

  if (source.kind === "onboard" && !options.offline) {
    try {
      const check = await checkUsername(options.baseUrl, source.username);
      if (!check.available) {
        io.err(`${source.username}@cooperemail.com is not available (${check.reason ?? "taken"}).`);
        if (check.suggestions?.length) io.err(`Try: ${check.suggestions.join(", ")}`);
        return 1;
      }
    } catch (cause) {
      io.err(`Could not check the username: ${(cause as Error).message}`);
      return 1;
    }
  }
  if ((source.kind === "flag" || source.kind === "env" || source.kind === "saved") && !options.offline) {
    try {
      await whoami(options.baseUrl, source.apiKey);
    } catch (cause) {
      if (cause instanceof CooperApiError && cause.status === 401) {
        io.err(`That API key was rejected by Cooper (${cause.code ?? "401"}). Check it, or use --username to create a new one.`);
        return 1;
      }
      io.err(`Warning: could not verify the API key: ${(cause as Error).message}`);
    }
  }

  // Plan with a placeholder key when the key does not exist yet; it is re-planned after onboarding.
  const placeholder = source.kind === "onboard" ? "coop_live_pending" : undefined;
  const planKey = source.kind === "oauth" ? undefined : source.kind === "onboard" ? placeholder : source.apiKey;
  const firstPlan = await plan(ctx, agents, { url: mcpUrl, ...(planKey ? { apiKey: planKey } : {}) }, options.skill);
  const credentials = credentialsPath(ctx);
  const savedNow = await readCredentials(ctx);
  const saveKey =
    source.kind === "onboard" ||
    ((source.kind === "flag" || source.kind === "env") && savedNow?.api_key !== source.apiKey);

  const summary = {
    agents: agents.map((a) => a.id),
    mcp_url: mcpUrl,
    auth: describeKey(source),
    changes: firstPlan.actions.map((a) =>
      a.type === "config"
        ? { type: "config", agent: a.agent.id, path: a.path, kind: a.kind, backup: a.fileExists, warnings: a.warnings }
        : { type: "skill", path: a.path, kind: a.kind },
    ),
    unchanged: firstPlan.unchanged,
    errors: firstPlan.errors,
    ...(saveKey ? { credentials_file: credentials } : {}),
  };

  if (!options.json) {
    io.out(`Cooper Email setup (${mcpUrl})`);
    io.out(`Agents: ${agents.map((a) => a.name).join(", ")}`);
    io.out(`Auth:   ${describeKey(source)}`);
    io.out("");
    if (firstPlan.actions.length > 0 || source.kind === "onboard" || saveKey) {
      io.out("Planned changes:");
      if (source.kind === "onboard") io.out(`  + create inbox ${source.username}@cooperemail.com (free plan) and an API key`);
      for (const action of firstPlan.actions) {
        if (action.type === "config") {
          io.out(`  ${action.kind === "create" ? "+" : "~"} ${action.agent.name}: ${action.kind === "create" ? "add" : "update"} "${SERVER_NAME}" in ${action.path}`);
          if (action.fileExists) io.out(`      backup first: ${action.path}.cooper-email.bak`);
          for (const warning of action.warnings) io.out(`      note: ${warning}`);
        } else io.out(`  ${action.kind === "create" ? "+" : "~"} skill: ${action.path}`);
      }
      if (saveKey) io.out(`  + save the API key (mode 600) to ${credentials}`);
    }
    for (const line of firstPlan.unchanged) io.out(`  = already set: ${line}`);
    for (const line of firstPlan.errors) io.err(`  ! skipped ${line}`);
    io.out("");
  }

  const nothingToDo = firstPlan.actions.length === 0 && source.kind !== "onboard";
  if (options.dryRun) {
    if (options.json) io.out(JSON.stringify({ status: "dry_run", ...summary }, null, 2));
    else io.out("Dry run: nothing was changed.");
    return firstPlan.errors.length > 0 ? 1 : 0;
  }
  if (nothingToDo && !saveKey) {
    if (options.json) io.out(JSON.stringify({ status: "unchanged", ...summary }, null, 2));
    else io.out("Everything is already set up.");
    return firstPlan.errors.length > 0 ? 1 : 0;
  }
  if (!options.yes) {
    if (!io.interactive) {
      io.err("Not running in a terminal. Review the plan above, then rerun with --yes to apply it.");
      return 2;
    }
    if (!(await confirm(io, "Apply these changes?"))) {
      io.out("Cancelled. Nothing was changed.");
      return 1;
    }
  }

  let apiKey: string | undefined = source.kind === "oauth" ? undefined : source.kind === "onboard" ? undefined : source.apiKey;
  let inboxEmail: string | undefined;
  if (source.kind === "onboard") {
    try {
      const result = await onboard(options.baseUrl, {
        username: source.username,
        ...(source.displayName ? { display_name: source.displayName } : {}),
      });
      apiKey = result.api_key;
      inboxEmail = result.inbox.email;
    } catch (cause) {
      io.err(`Could not create the inbox: ${(cause as Error).message}. Nothing was changed.`);
      return 1;
    }
  }
  if (saveKey && apiKey !== undefined) {
    const existing = await readCredentials(ctx);
    if (existing?.api_key !== apiKey) {
      if (existing !== undefined) await backup(credentials);
      await writeAtomic(
        credentials,
        `${JSON.stringify(
          {
            api_key: apiKey,
            ...(inboxEmail ? { inbox: inboxEmail } : {}),
            base_url: options.baseUrl,
            created_at: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
      );
    }
  }

  const finalPlan =
    source.kind === "onboard"
      ? await plan(ctx, agents, { url: mcpUrl, ...(apiKey ? { apiKey } : {}) }, options.skill)
      : firstPlan;
  const applied: { path: string; backup?: string }[] = [];
  const failures: string[] = [...finalPlan.errors];
  for (const action of finalPlan.actions) {
    try {
      if (action.type === "config") {
        const backupPath = action.fileExists ? await backup(action.path) : undefined;
        await writeAtomic(action.path, action.content);
        // Read back and confirm the registration parses.
        const check = inspectRegistration(action.agent, (await readOptional(action.path)) ?? "");
        if (!check.present || check.url !== mcpUrl) throw new Error("read-back check failed");
        applied.push({ path: action.path, ...(backupPath ? { backup: backupPath } : {}) });
      } else {
        await writeAtomic(action.path, SKILL_MD);
        applied.push({ path: action.path });
      }
    } catch (cause) {
      failures.push(`${action.path}: ${(cause as Error).message}`);
    }
  }

  if (options.json) {
    io.out(
      JSON.stringify(
        { status: failures.length > 0 ? "partial" : "applied", ...summary, applied, failures, ...(inboxEmail ? { inbox: inboxEmail } : {}) },
        null,
        2,
      ),
    );
  } else {
    for (const item of applied) io.out(`✓ ${item.path}${item.backup ? ` (backup: ${item.backup})` : ""}`);
    for (const failure of failures) io.err(`✗ ${failure}`);
    if (inboxEmail) {
      io.out("");
      io.out(`Your agent's address: ${inboxEmail}`);
      io.out(`API key saved to ${credentials} (${redact(apiKey!)}). It is shown only once by Cooper; keep that file private.`);
    }
    io.out("");
    for (const agent of agents) if (agent.note) io.out(`${agent.name}: ${agent.note}`);
    io.out("Restart your agents so they load the new MCP server, then try: \"Check my Cooper inbox\".");
    io.out("Check the connection any time with: npx cooper-email doctor");
  }
  return failures.length > 0 ? 1 : 0;
};

interface DoctorAgentReport {
  agent: string;
  config: string;
  status: "ok" | "missing" | "not_registered" | "invalid" | "wrong_url";
  auth?: "api_key" | "oauth";
  key?: string;
  detail?: string;
}

const runDoctor = async (ctx: PathContext, options: Options, io: Io): Promise<number> => {
  const agents = await selectAgents(ctx, options);
  const mcpUrl = `${options.baseUrl}/mcp`;
  const reports: DoctorAgentReport[] = [];
  const keys = new Set<string>();
  for (const agent of agents) {
    const path = agent.configPath(ctx);
    const text = await readOptional(path);
    if (text === undefined) {
      reports.push({ agent: agent.id, config: path, status: "missing" });
      continue;
    }
    try {
      const reg = inspectRegistration(agent, text);
      if (!reg.present) reports.push({ agent: agent.id, config: path, status: "not_registered" });
      else {
        if (reg.apiKey) keys.add(reg.apiKey);
        reports.push({
          agent: agent.id,
          config: path,
          status: reg.url === mcpUrl ? "ok" : "wrong_url",
          auth: reg.apiKey ? "api_key" : "oauth",
          ...(reg.apiKey ? { key: redact(reg.apiKey) } : {}),
          ...(reg.url !== mcpUrl ? { detail: `points at ${reg.url ?? "no url"}` } : {}),
        });
      }
    } catch (cause) {
      reports.push({ agent: agent.id, config: path, status: "invalid", detail: (cause as Error).message });
    }
  }
  const skills = await Promise.all(
    skillTargets(ctx, agents).map(async (dir) => {
      const text = await readOptional(join(dir, "SKILL.md"));
      return { path: join(dir, "SKILL.md"), status: text === undefined ? "missing" : text === SKILL_MD ? "current" : "outdated" };
    }),
  );
  const envKey = ctx.env.COOPER_API_KEY || undefined;
  const saved = await readCredentials(ctx);
  const key = options.apiKey ?? envKey ?? saved?.api_key ?? [...keys][0];
  const live: { api?: string; mcp?: Awaited<ReturnType<typeof probeMcp>> } = {};
  if (!options.offline) {
    if (key !== undefined) {
      try {
        await whoami(options.baseUrl, key);
        live.api = "ok";
      } catch (cause) {
        live.api = `failed: ${(cause as Error).message}`;
      }
    }
    live.mcp = await probeMcp(mcpUrl, key);
  }
  const problems =
    reports.filter((r) => r.status !== "ok").length +
    (live.api !== undefined && live.api !== "ok" ? 1 : 0) +
    (live.mcp !== undefined && (!live.mcp.ok || live.mcp.authenticated === false) ? 1 : 0);
  if (options.json) {
    io.out(
      JSON.stringify(
        { ok: problems === 0 && reports.length > 0, mcp_url: mcpUrl, agents: reports, skills, key: key ? redact(key) : null, live },
        null,
        2,
      ),
    );
  } else {
    io.out(`Cooper Email doctor (${mcpUrl})`);
    if (reports.length === 0) io.out("  No supported agents detected. Use --agent to check one.");
    for (const r of reports) {
      const mark = r.status === "ok" ? "✓" : "✗";
      const label = findAgent(r.agent)?.name ?? r.agent;
      const text =
        r.status === "ok"
          ? `registered (${r.auth === "api_key" ? `API key ${r.key}` : "OAuth sign-in"})`
          : r.status === "missing"
            ? "config file not found; run setup"
            : r.status === "not_registered"
              ? "cooper-email is not registered; run setup"
              : r.status === "wrong_url"
                ? `cooper-email ${r.detail}`
                : `config could not be read: ${r.detail}`;
      io.out(`  ${mark} ${label}: ${text}  [${r.config}]`);
    }
    for (const s of skills) io.out(`  ${s.status === "current" ? "✓" : "✗"} skill ${s.status}: ${s.path}`);
    if (options.offline) io.out("  - network checks skipped (--offline)");
    else {
      if (key === undefined) io.out("  - no API key found (OAuth sign-in happens inside each agent)");
      else io.out(`  ${live.api === "ok" ? "✓" : "✗"} API key ${redact(key)}: ${live.api}`);
      const m = live.mcp!;
      io.out(
        m.ok
          ? `  ${m.authenticated === false ? "✗" : "✓"} MCP: ${m.serverName ?? "server"} answered initialize and tools/list (${m.toolCount} tools, protocol ${m.protocolVersion})${m.authenticated === undefined ? "" : m.authenticated ? "; cooper_whoami authenticated" : "; cooper_whoami was rejected"}`
          : `  ✗ MCP: ${m.error}`,
      );
    }
    io.out(problems === 0 && reports.length > 0 ? "All good." : `${problems} problem(s) found.`);
  }
  return problems === 0 && reports.length > 0 ? 0 : 1;
};

const runUninstall = async (ctx: PathContext, options: Options, io: Io): Promise<number> => {
  const agents = options.agents.length > 0 ? await selectAgents(ctx, options) : [...AGENTS];
  const edits: { agent: AgentDefinition; path: string; content: string }[] = [];
  const errors: string[] = [];
  for (const agent of agents) {
    const path = agent.configPath(ctx);
    const text = await readOptional(path);
    if (text === undefined) continue;
    try {
      const next = planRemoval(agent, text);
      if (next !== undefined) edits.push({ agent, path, content: next });
    } catch (cause) {
      errors.push(`${agent.name}: ${path}: ${(cause as Error).message}`);
    }
  }
  const skillDirs: string[] = [];
  for (const dir of skillTargets(ctx, agents)) if (await exists(join(dir, "SKILL.md"))) skillDirs.push(dir);
  const credentials = credentialsPath(ctx);
  const removeCreds = options.removeCredentials && (await exists(credentials));
  if (edits.length === 0 && skillDirs.length === 0 && !removeCreds) {
    io.out("Nothing to remove: cooper-email is not registered with any agent.");
    for (const e of errors) io.err(`  ! ${e}`);
    return errors.length > 0 ? 1 : 0;
  }
  io.out("Planned removals:");
  for (const e of edits) io.out(`  - ${e.agent.name}: remove "${SERVER_NAME}" from ${e.path} (backup first)`);
  for (const d of skillDirs) io.out(`  - skill: ${d}`);
  if (removeCreds) io.out(`  - saved API key: ${credentials}`);
  else if (await exists(credentials)) io.out(`  = keeping saved API key ${credentials} (pass --remove-credentials to delete it)`);
  for (const e of errors) io.err(`  ! skipped ${e}`);
  if (options.dryRun) {
    io.out("Dry run: nothing was changed.");
    return 0;
  }
  if (!options.yes) {
    if (!io.interactive) {
      io.err("Not running in a terminal. Rerun with --yes to apply.");
      return 2;
    }
    if (!(await confirm(io, "Remove these?"))) {
      io.out("Cancelled. Nothing was changed.");
      return 1;
    }
  }
  for (const e of edits) {
    const b = await backup(e.path);
    await writeAtomic(e.path, e.content);
    io.out(`✓ ${e.path} (backup: ${b})`);
  }
  for (const d of skillDirs) {
    await removeDir(d);
    io.out(`✓ removed ${d}`);
  }
  if (removeCreds) {
    await removeDir(dirname(credentials));
    io.out(`✓ removed ${credentials}`);
  }
  io.out("Your Cooper inbox and account were not deleted.");
  return errors.length > 0 ? 1 : 0;
};

export const run = async (context: RunContext): Promise<number> => {
  const io = context.io ?? systemIo();
  const ctx: PathContext = {
    home: context.home ?? context.env.HOME ?? homedir(),
    env: context.env,
    platform: context.platform ?? process.platform,
  };
  try {
    const { command, options } = parseArgs(context.argv, context.env);
    if (command === "version") {
      io.out(VERSION);
      return 0;
    }
    if (options.help || command === undefined || command === "help") {
      io.out(HELP);
      return command === undefined && !options.help ? 1 : 0;
    }
    switch (command) {
      case "setup":
      case "install":
        return await runSetup(ctx, options, io);
      case "doctor":
        return await runDoctor(ctx, options, io);
      case "uninstall":
      case "remove":
        return await runUninstall(ctx, options, io);
      default:
        throw new UsageError(`unknown command "${command}"`);
    }
  } catch (cause) {
    if (cause instanceof UsageError) {
      io.err(`cooper-email: ${cause.message}`);
      io.err("Run npx cooper-email --help for usage.");
      return 1;
    }
    io.err(`cooper-email: ${(cause as Error).message}`);
    return 1;
  }
};
