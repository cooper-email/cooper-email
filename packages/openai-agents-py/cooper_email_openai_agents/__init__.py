"""OpenAI Agents SDK function tools for Cooper Email."""

from __future__ import annotations

from typing import Any, Callable

from cooper_email import COOPER_TOOLS, execute_tool


def function_tools(client: Any) -> list[Callable[..., Any]]:
    """Plain functions with Cooper tool names and docstrings.

    Wrap each one with `agents.function_tool`, or call `load_function_tools`.
    """
    functions: list[Callable[..., Any]] = []
    for spec in COOPER_TOOLS:
        def run(_name: str = spec["name"], **kwargs: Any) -> Any:
            return execute_tool(client, _name, kwargs)

        run.__name__ = spec["name"]
        run.__doc__ = spec["description"]
        functions.append(run)
    return functions


def load_function_tools(client: Any) -> list[Any]:
    try:
        from agents import function_tool
    except ImportError as exc:
        raise ImportError(
            "Install the OpenAI Agents SDK to use load_function_tools (pip install openai-agents)."
        ) from exc
    return [function_tool(fn) for fn in function_tools(client)]
