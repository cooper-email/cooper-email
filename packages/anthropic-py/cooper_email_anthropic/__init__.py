"""Anthropic tool-use definitions for Cooper Email."""

from __future__ import annotations

from typing import Any

from cooper_email import COOPER_TOOLS, execute_tool


def anthropic_tools() -> list[dict[str, Any]]:
    """Tools for `messages.create(..., tools=anthropic_tools())`."""
    return [
        {"name": tool["name"], "description": tool["description"], "input_schema": tool["input_schema"]}
        for tool in COOPER_TOOLS
    ]


def run_tool(client: Any, name: str, tool_input: dict[str, Any] | None) -> Any:
    """Run a tool_use block against Cooper."""
    return execute_tool(client, name, tool_input or {})
