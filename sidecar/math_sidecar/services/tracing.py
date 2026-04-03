"""Optional LangSmith tracing helpers.

The sidecar should remain importable even when LangSmith is not installed
or tracing is not configured. This module provides a no-op decorator in that
case so higher-level services can opt into tracing without hard dependency
failures.
"""

from collections.abc import Callable
from typing import Any

from ..config import settings

try:
    from langsmith import traceable as _traceable
except Exception:  # pragma: no cover - optional dependency
    _traceable = None


def traceable(*args: Any, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Return a LangSmith trace decorator when enabled, else a no-op."""
    if _traceable is None or not settings.langsmith_tracing:
        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            return func

        return decorator

    return _traceable(*args, **kwargs)
