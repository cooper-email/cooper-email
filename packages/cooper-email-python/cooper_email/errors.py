from __future__ import annotations

from typing import Any

import httpx


class CooperApiError(Exception):
    def __init__(
        self,
        *,
        status: int,
        type: str,
        code: str,
        message: str,
        param: str | None = None,
        docs_url: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.type = type
        self.code = code
        self.message = message
        self.param = param
        self.docs_url = docs_url

    @classmethod
    def from_response(cls, response: httpx.Response) -> "CooperApiError":
        payload: Any
        try:
            payload = response.json()
        except Exception:
            payload = None
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict) and isinstance(error.get("message"), str):
            return cls(
                status=response.status_code,
                type=str(error.get("type") or "api_error"),
                code=str(error.get("code") or "api_error"),
                message=error["message"],
                param=error.get("param") if isinstance(error.get("param"), str) else None,
                docs_url=error.get("docs_url") if isinstance(error.get("docs_url"), str) else None,
            )
        text = response.text.strip() or f"Cooper Email returned HTTP {response.status_code}."
        return cls(status=response.status_code, type="api_error", code="api_error", message=text)

    @classmethod
    def missing(cls, field: str) -> "CooperApiError":
        return cls(
            status=400,
            type="invalid_request",
            code="missing_field",
            message=f"Missing {field}.",
            param=field,
        )
