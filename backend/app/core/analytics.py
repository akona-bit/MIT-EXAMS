"""PostHog analytics helpers — thin wrappers to keep route files clean."""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request

logger = logging.getLogger(__name__)


def _get_client(request: Request):
    """Return the shared PostHog client, or None if not configured."""
    return getattr(request.app.state, "posthog_client", None)


def capture(
    request: Request,
    event: str,
    properties: Optional[dict[str, Any]] = None,
) -> None:
    """Capture within the PostHog context established for this request."""
    client = _get_client(request)
    if client is None:
        return
    try:
        client.capture(event=event, properties=properties or {})
    except Exception:
        logger.warning("PostHog capture failed for event=%s", event, exc_info=True)
