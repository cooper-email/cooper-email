"""LlamaIndex ToolSpec for Cooper Email."""

from __future__ import annotations

from typing import Any

from cooper_email import COOPER_TOOLS, execute_tool


class CooperEmailToolSpec:
    """ToolSpec-shaped wrapper. `spec_functions` lists every Cooper tool.

    `to_tool_list()` needs `llama-index-core`. The methods themselves call Cooper
    with no LlamaIndex install.
    """

    spec_functions = [tool["name"] for tool in COOPER_TOOLS]

    def __init__(self, client: Any) -> None:
        self.client = client
        for name in self.spec_functions:
            setattr(self, name, self._bind(name))

    def _bind(self, name: str):
        def run(**kwargs: Any) -> Any:
            return execute_tool(self.client, name, kwargs)

        run.__name__ = name
        return run

    def to_tool_list(self) -> list[Any]:
        try:
            from llama_index.core.tools.tool_spec.base import BaseToolSpec
        except ImportError as exc:
            raise ImportError(
                "Install llama-index-core to call to_tool_list (pip install llama-index-core)."
            ) from exc

        spec = self

        class _Bound(BaseToolSpec):  # type: ignore[misc]
            spec_functions = list(CooperEmailToolSpec.spec_functions)

            def __init__(self) -> None:
                for fn in self.spec_functions:
                    setattr(self, fn, getattr(spec, fn))

        return _Bound().to_tool_list()
