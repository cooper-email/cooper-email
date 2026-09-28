from __future__ import annotations

from typing import Any

import httpx

from cooper_email.calls import Call
from cooper_email.errors import CooperApiError

SDK_VERSION = "0.1.0"
DEFAULT_BASE_URL = "https://cooperemail.com"
USER_AGENT = f"cooper-email-python/{SDK_VERSION}"


def decode(response: httpx.Response, *, raw: bool) -> Any:
    if response.status_code >= 400:
        raise CooperApiError.from_response(response)
    if raw:
        return {
            "bytes": response.content,
            "content_type": response.headers.get("content-type"),
            "content_disposition": response.headers.get("content-disposition"),
        }
    if not response.content:
        return None
    return response.json()


def headers_for(api_key: str | None, call: Call) -> dict[str, str]:
    headers = {"accept": "*/*" if call.raw else "application/json", "user-agent": USER_AGENT}
    if api_key:
        headers["authorization"] = f"Bearer {api_key}"
    if call.json is not None:
        headers["content-type"] = "application/json"
    return headers


class CooperHttp:
    def __init__(
        self,
        *,
        api_key: str | None,
        base_url: str,
        client: httpx.Client | None,
        transport: httpx.BaseTransport | None,
        timeout: float,
    ) -> None:
        self.api_key = api_key or None
        self.base_url = base_url.rstrip("/")
        self._owns = client is None
        self._client = client or httpx.Client(base_url=self.base_url, transport=transport, timeout=timeout)

    def request(self, call: Call) -> Any:
        response = self._client.request(
            call.method,
            call.path,
            headers=headers_for(self.api_key, call),
            json=call.json,
            params=call.params,
        )
        return decode(response, raw=call.raw)

    def close(self) -> None:
        if self._owns:
            self._client.close()


class AsyncCooperHttp:
    def __init__(
        self,
        *,
        api_key: str | None,
        base_url: str,
        client: httpx.AsyncClient | None,
        transport: httpx.BaseTransport | None,
        timeout: float,
    ) -> None:
        self.api_key = api_key or None
        self.base_url = base_url.rstrip("/")
        self._owns = client is None
        self._client = client or httpx.AsyncClient(base_url=self.base_url, transport=transport, timeout=timeout)

    async def request(self, call: Call) -> Any:
        response = await self._client.request(
            call.method,
            call.path,
            headers=headers_for(self.api_key, call),
            json=call.json,
            params=call.params,
        )
        return decode(response, raw=call.raw)

    async def close(self) -> None:
        if self._owns:
            await self._client.aclose()
