from __future__ import annotations

import hashlib
import hmac


def sign_webhook_payload(secret: str, payload: str | bytes) -> str:
    """HMAC-SHA256 of the raw body. Header value is `sha256=<hex>`."""
    data = payload.encode("utf-8") if isinstance(payload, str) else payload
    digest = hmac.new(secret.encode("utf-8"), data, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_webhook_signature(*, secret: str, payload: str | bytes, signature: str | None) -> bool:
    """Return True when `x-cooper-signature` matches the raw body. Never raises."""
    header = (signature or "").strip()
    if not header or not secret:
        return False
    expected = sign_webhook_payload(secret, payload)
    return hmac.compare_digest(expected, header)
