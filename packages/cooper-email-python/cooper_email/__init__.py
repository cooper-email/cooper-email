"""Official Python SDK for Cooper Email. https://cooperemail.com"""

from cooper_email.async_client import AsyncCooper
from cooper_email.client import Cooper
from cooper_email.errors import CooperApiError
from cooper_email.http import DEFAULT_BASE_URL, SDK_VERSION
from cooper_email.threads import group_threads
from cooper_email.tools import COOPER_TOOLS, execute_tool, execute_tool_async
from cooper_email.webhooks import sign_webhook_payload, verify_webhook_signature

__all__ = [
    "AsyncCooper",
    "COOPER_TOOLS",
    "Cooper",
    "CooperApiError",
    "DEFAULT_BASE_URL",
    "SDK_VERSION",
    "execute_tool",
    "execute_tool_async",
    "group_threads",
    "sign_webhook_payload",
    "verify_webhook_signature",
]
