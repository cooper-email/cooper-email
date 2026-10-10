import { existsSync } from "node:fs";
import { join } from "node:path";

/** Name Cooper registers under in every agent configuration. */
export const SERVER_NAME = "cooper-email";

export type ConfigFormat =
  | "claude_code"
  | "claude_desktop"
  | "cursor"
  | "gemini"
  | "windsurf"
  | "vscode"
  | "opencode"
  | "copilot"
  | "codex"
  | "grok";

export interface PathContext {
  readonly home: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: NodeJS.Platform;
}

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly format: ConfigFormat;
  /** Config file setup edits. */
  configPath(ctx: PathContext): string;
  /** Paths whose existence means the agent is installed. */
  markers(ctx: PathContext): readonly string[];
  /** Skill root directories this agent reads (a cooper-email/ folder goes inside). */
  skillRoots(ctx: PathContext): readonly string[];
  /** Short note shown after setup. */
  readonly note?: string;
}

const nonEmpty = (value: string | undefined): string | undefined =>
  value === undefined || value === "" ? undefined : value;

const xdgConfig = ({ home, env }: PathContext): string =>
  nonEmpty(env.XDG_CONFIG_HOME) ?? join(home, ".config");

const appData = ({ home, env }: PathContext): string =>
  nonEmpty(env.APPDATA) ?? join(home, "AppData", "Roaming");

export const sharedSkillRoot = ({ home }: PathContext): string =>
  join(home, ".agents", "skills");

const claudeConfigDir = (ctx: PathContext): string | undefined =>
  nonEmpty(ctx.env.CLAUDE_CONFIG_DIR);

const claudeDesktopDir = (ctx: PathContext): string =>
  ctx.platform === "win32"
    ? join(appData(ctx), "Claude")
    : ctx.platform === "darwin"
      ? join(ctx.home, "Library", "Application Support", "Claude")
      : join(xdgConfig(ctx), "Claude");

const vscodeUserDir = (ctx: PathContext): string =>
  ctx.platform === "win32"
    ? join(appData(ctx), "Code", "User")
    : ctx.platform === "darwin"
      ? join(ctx.home, "Library", "Application Support", "Code", "User")
      : join(xdgConfig(ctx), "Code", "User");

const codexDir = (ctx: PathContext): string =>
  nonEmpty(ctx.env.CODEX_HOME) ?? join(ctx.home, ".codex");

const grokDir = (ctx: PathContext): string =>
  nonEmpty(ctx.env.GROK_HOME) ?? join(ctx.home, ".grok");

const geminiHome = (ctx: PathContext): string =>
  nonEmpty(ctx.env.GEMINI_CLI_HOME) ?? ctx.home;

const copilotDir = (ctx: PathContext): string =>
  nonEmpty(ctx.env.COPILOT_HOME) ?? join(ctx.home, ".copilot");

/** Windsurf's successor keeps Cascade MCP servers here. */
const devinDir = (ctx: PathContext): string =>
  ctx.platform === "win32" ? join(appData(ctx), "devin") : join(xdgConfig(ctx), "devin");

const opencodeDir = (ctx: PathContext): string =>
  nonEmpty(ctx.env.OPENCODE_CONFIG_DIR) ?? join(xdgConfig(ctx), "opencode");

export const AGENTS: readonly AgentDefinition[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    format: "claude_code",
    configPath: (ctx) => join(claudeConfigDir(ctx) ?? ctx.home, ".claude.json"),
    markers: (ctx) => {
      const dir = claudeConfigDir(ctx);
      return dir !== undefined
        ? [dir]
        : [join(ctx.home, ".claude"), join(ctx.home, ".claude.json")];
    },
    skillRoots: (ctx) => [
      join(claudeConfigDir(ctx) ?? join(ctx.home, ".claude"), "skills"),
    ],
    note: "Restart Claude Code, then run /mcp to see cooper-email.",
  },
  {
    id: "codex",
    name: "Codex",
    format: "codex",
    configPath: (ctx) => join(codexDir(ctx), "config.toml"),
    markers: (ctx) => [codexDir(ctx)],
    skillRoots: (ctx) => [sharedSkillRoot(ctx)],
  },
  {
    id: "cursor",
    name: "Cursor",
    format: "cursor",
    configPath: (ctx) => join(ctx.home, ".cursor", "mcp.json"),
    markers: (ctx) => [join(ctx.home, ".cursor")],
    skillRoots: (ctx) => [sharedSkillRoot(ctx)],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    format: "gemini",
    configPath: (ctx) => join(geminiHome(ctx), ".gemini", "settings.json"),
    markers: (ctx) => [join(geminiHome(ctx), ".gemini")],
    skillRoots: (ctx) => [join(geminiHome(ctx), ".agents", "skills")],
  },
  {
    id: "grok",
    name: "Grok Build",
    format: "grok",
    configPath: (ctx) => join(grokDir(ctx), "config.toml"),
    markers: (ctx) => [grokDir(ctx)],
    skillRoots: (ctx) => [sharedSkillRoot(ctx)],
  },
  {
    id: "vscode",
    name: "VS Code",
    format: "vscode",
    configPath: (ctx) => join(vscodeUserDir(ctx), "mcp.json"),
    markers: (ctx) => [vscodeUserDir(ctx)],
    skillRoots: (ctx) => [sharedSkillRoot(ctx)],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    format: "windsurf",
    configPath: (ctx) => join(ctx.home, ".codeium", "windsurf", "mcp_config.json"),
    markers: (ctx) => [join(ctx.home, ".codeium", "windsurf")],
    skillRoots: (ctx) => [sharedSkillRoot(ctx)],
  },
  {
    id: "devin",
    name: "Devin Desktop (Cascade)",
    format: "windsurf",
    configPath: (ctx) => join(devinDir(ctx), "mcp_config.json"),
    markers: (ctx) => [devinDir(ctx)],
    skillRoots: (ctx) => [sharedSkillRoot(ctx)],
  },
  {
    id: "opencode",
    name: "OpenCode",
    format: "opencode",
    configPath: (ctx) => {
      const jsonc = join(opencodeDir(ctx), "opencode.jsonc");
      const json = join(opencodeDir(ctx), "opencode.json");
      return !existsSync(json) && existsSync(jsonc) ? jsonc : json;
    },
    markers: (ctx) => [opencodeDir(ctx)],
    skillRoots: (ctx) => [sharedSkillRoot(ctx)],
  },
  {
    id: "copilot",
    name: "GitHub Copilot CLI",
    format: "copilot",
    configPath: (ctx) => join(copilotDir(ctx), "mcp-config.json"),
    markers: (ctx) => [copilotDir(ctx)],
    skillRoots: (ctx) => [sharedSkillRoot(ctx)],
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    format: "claude_desktop",
    configPath: (ctx) => join(claudeDesktopDir(ctx), "claude_desktop_config.json"),
    markers: (ctx) => [claudeDesktopDir(ctx)],
    skillRoots: () => [],
    note: "Claude Desktop reaches the remote server through the mcp-remote bridge (needs Node.js). You can also add https://cooperemail.com/mcp under Settings → Connectors instead.",
  },
];

export const agentIds = (): string[] => AGENTS.map(({ id }) => id);

export const findAgent = (id: string): AgentDefinition | undefined =>
  AGENTS.find((agent) => agent.id === id);
