#!/usr/bin/env python3
"""Check that every plugin/extension manifest in this repo agrees and points at real files.

Covers the root Agent Plugin (plugin.json + mcp.json), Cursor (.cursor-plugin), Codex (.codex-plugin + .agents/plugins), GitHub Copilot CLI
(.plugin), Gemini CLI (gemini-extension.json), and the skills folder they share. The Claude Code
plugin lives in claude-plugin/ and is checked by `claude plugin validate`.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURSOR_SCHEMA = (
    "https://raw.githubusercontent.com/cursor/plugins/"
    "7a583913eb1b8d1a0ee76753d1a2cf072e7b54f9/schemas/plugin.schema.json"
)
MCP_URL = "https://cooperemail.com/mcp"
AP_PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
AP_MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"
AP_PLUGIN_KEYS = {
    "$schema", "name", "version", "description", "author", "homepage",
    "repository", "license", "keywords", "extensions",
}
NAME_RE = re.compile(r"^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$")

errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def load(rel: str) -> dict:
    path = ROOT / rel
    try:
        return json.loads(path.read_text())
    except Exception as exc:  # noqa: BLE001
        fail(f"{rel}: cannot parse ({exc})")
        return {}


def check_path(owner: str, rel: str | None) -> None:
    if not isinstance(rel, str) or rel.startswith("http"):
        return
    if rel.startswith("/") or ".." in Path(rel).parts:
        fail(f"{owner}: path must be relative inside the repo: {rel}")
    elif not (ROOT / rel).exists():
        fail(f"{owner}: missing path {rel}")


def frontmatter(text: str) -> dict[str, str]:
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not match:
        return {}
    out: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" in line and not line.startswith((" ", "\t", "-")):
            key, value = line.split(":", 1)
            out[key.strip()] = value.strip()
    return out


def main() -> int:
    cursor = load(".cursor-plugin/plugin.json")
    codex = load(".codex-plugin/plugin.json")
    copilot = load(".plugin/plugin.json")
    gemini = load("gemini-extension.json")
    market = load(".agents/plugins/marketplace.json")
    mcp = load(".mcp.json")
    agent_plugin = load("plugin.json")
    agent_mcp = load("mcp.json")

    for label, manifest in (("cursor", cursor), ("codex", codex), ("copilot", copilot), ("gemini", gemini)):
        if manifest.get("name") != "cooper-email":
            fail(f"{label}: name must be cooper-email")
        if not NAME_RE.match(manifest.get("name", "")):
            fail(f"{label}: invalid name")
    versions = {m.get("version") for m in (cursor, codex, copilot, gemini)}
    if len(versions) != 1:
        fail(f"manifest versions differ: {sorted(map(str, versions))}")

    for label, manifest in (("cursor", cursor), ("codex", codex), ("copilot", copilot)):
        for key in ("skills", "mcpServers", "logo"):
            check_path(label, manifest.get(key))
    for key in ("logo", "composerIcon"):
        check_path("codex.interface", codex.get("interface", {}).get(key))

    try:
        with urllib.request.urlopen(CURSOR_SCHEMA, timeout=30) as response:
            allowed = set(json.load(response)["properties"])
        extra = set(cursor) - allowed
        if extra:
            fail(f"cursor: keys not in Cursor schema: {sorted(extra)}")
    except Exception as exc:  # noqa: BLE001
        print(f"warning: could not fetch Cursor schema ({exc})", file=sys.stderr)

    servers = mcp.get("mcpServers", {})
    if servers.get("cooper-email", {}).get("url") != MCP_URL:
        fail(".mcp.json: cooper-email must point at the hosted MCP server")
    if any("headers" in s or "env" in s for s in servers.values()):
        fail(".mcp.json: no credentials or headers may be committed")

    # Root Agent Plugin (agent-plugins.org 1.0.0): plugin.json + mcp.json + skills/
    if agent_plugin.get("$schema") != AP_PLUGIN_SCHEMA:
        fail("plugin.json: $schema must be the Agent Plugins 1.0.0 plugin schema")
    for key in ("name", "version", "description", "author", "keywords"):
        if not agent_plugin.get(key):
            fail(f"plugin.json: missing {key}")
    extra = set(agent_plugin) - AP_PLUGIN_KEYS
    if extra:
        fail(f"plugin.json: keys not in the Agent Plugins schema: {sorted(extra)}")
    if agent_mcp.get("$schema") != AP_MCP_SCHEMA:
        fail("mcp.json: $schema must be the Agent Plugins 1.0.0 MCP schema")
    if set(agent_mcp) - {"$schema", "mcpServers"}:
        fail("mcp.json: only $schema and mcpServers are allowed")
    server = agent_mcp.get("mcpServers", {}).get("cooper-email", {})
    if server != {"type": "streamable-http", "url": MCP_URL}:
        fail("mcp.json: cooper-email must be streamable-http at the hosted MCP server, with no headers")
    if gemini.get("mcpServers", {}).get("cooper-email", {}).get("url") != MCP_URL:
        fail("gemini-extension.json: cooper-email must point at the hosted MCP server")
    if gemini.get("contextFileName"):
        check_path("gemini", gemini["contextFileName"])

    plugins = market.get("plugins", [])
    if not any(p.get("name") == "cooper-email" and p.get("source", {}).get("path") == "./" for p in plugins):
        fail(".agents/plugins/marketplace.json: cooper-email entry must point at ./")

    skills = sorted(p.parent for p in (ROOT / "skills").glob("*/SKILL.md"))
    if not skills:
        fail("skills/: no skills found")
    for skill in skills:
        fm = frontmatter((skill / "SKILL.md").read_text())
        if fm.get("name") != skill.name:
            fail(f"{skill.name}: frontmatter name must match the folder")
        description = fm.get("description", "")
        if not description:
            fail(f"{skill.name}: missing description")
        if len(description) > 1024:
            fail(f"{skill.name}: description is over 1024 characters")
        if not (skill / "agents" / "openai.yaml").is_file():
            fail(f"{skill.name}: missing agents/openai.yaml")

    if errors:
        for message in errors:
            print(f"ERROR: {message}", file=sys.stderr)
        return 1
    print(f"OK: {len(skills)} skills, version {versions.pop()}, manifests agree")
    return 0


if __name__ == "__main__":
    sys.exit(main())
