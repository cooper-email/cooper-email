"""CrewAI tools for Cooper Email."""

from __future__ import annotations

from typing import Any

from cooper_email import COOPER_TOOLS, execute_tool


def crewai_tools(client: Any) -> list[dict[str, Any]]:
    """CrewAI-shaped tools with name, description, and _run(**kwargs)."""
    tools: list[dict[str, Any]] = []
    for spec in COOPER_TOOLS:
        name = spec["name"]

        def _run(_name: str = name, **kwargs: Any) -> Any:
            return execute_tool(client, _name, kwargs)

        tools.append({"name": name, "description": spec["description"], "_run": _run})
    return tools


def load_crewai_tools(client: Any) -> list[Any]:
    """Instantiate crewai.tools.BaseTool subclasses. Requires crewai."""
    try:
        from crewai.tools import BaseTool
    except ImportError as exc:
        raise ImportError("Install crewai to use load_crewai_tools (pip install crewai).") from exc

    def build(name: str, description: str, run: Any) -> Any:
        class _Tool(BaseTool):
            name: str = name
            description: str = description

            def _run(self, **kwargs: Any) -> Any:
                return run(**kwargs)

        return _Tool()

    return [build(tool["name"], tool["description"], tool["_run"]) for tool in crewai_tools(client)]
