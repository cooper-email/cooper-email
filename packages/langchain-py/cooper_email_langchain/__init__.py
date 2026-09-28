"""LangChain tools for Cooper Email."""

from __future__ import annotations

from typing import Any, Callable

from cooper_email import COOPER_TOOLS, execute_tool


def langchain_tools(client: Any) -> list[dict[str, Any]]:
    """Framework-agnostic toolkit. Each item has name, description, args_schema, and run."""
    tools: list[dict[str, Any]] = []
    for spec in COOPER_TOOLS:
        name = spec["name"]

        def run(arguments: dict[str, Any] | None = None, _name: str = name) -> Any:
            return execute_tool(client, _name, arguments or {})

        tools.append(
            {
                "name": name,
                "description": spec["description"],
                "args_schema": spec["input_schema"],
                "run": run,
            }
        )
    return tools


def load_langchain_tools(client: Any) -> list[Any]:
    """Build langchain_core StructuredTool objects. Requires langchain-core."""
    try:
        from langchain_core.tools import StructuredTool
    except ImportError as exc:
        raise ImportError(
            "Install langchain-core to use load_langchain_tools (pip install langchain-core)."
        ) from exc

    loaded = []
    for tool in langchain_tools(client):
        runner: Callable[..., Any] = tool["run"]

        def _fn(_runner: Callable[..., Any] = runner, **kwargs: Any) -> Any:
            return _runner(kwargs)

        loaded.append(
            StructuredTool.from_function(func=_fn, name=tool["name"], description=tool["description"])
        )
    return loaded
