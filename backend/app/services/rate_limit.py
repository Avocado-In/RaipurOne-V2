"""In-process rate limiting for complaint intake.

There was previously no limit of any kind: with no authentication either, an anonymous
script could create unlimited complaints in a tight loop.

This is a sliding-window counter held in memory. That is honest about its scope - it is
per-process, so it resets on restart and does not coordinate across replicas. It stops
casual abuse and accidental double-submits, which is what a single-node deployment needs.
A multi-replica deployment should move this to Redis.
"""
from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException

logger = logging.getLogger("raipurone.ratelimit")

#: Max complaints per key per window.
MAX_PER_WINDOW = 5
WINDOW_SECONDS = 60

#: Longer guard so a single key cannot drip-feed indefinitely.
MAX_PER_HOUR = 30
HOUR_SECONDS = 3600

_events: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def _prune(stamps: deque[float], now: float) -> None:
    while stamps and now - stamps[0] > HOUR_SECONDS:
        stamps.popleft()


def check_rate_limit(key: str) -> tuple[bool, str | None]:
    """Return ``(allowed, message)`` without raising."""
    now = time.monotonic()
    with _lock:
        stamps = _events[key]
        _prune(stamps, now)
        recent = sum(1 for stamp in stamps if now - stamp <= WINDOW_SECONDS)
        if recent >= MAX_PER_WINDOW:
            return False, (
                f"Too many complaints in a short time. Please wait a minute before "
                f"submitting again (limit {MAX_PER_WINDOW} per minute)."
            )
        if len(stamps) >= MAX_PER_HOUR:
            return False, (
                f"Hourly submission limit reached (limit {MAX_PER_HOUR} per hour). "
                f"Please try again later."
            )
        stamps.append(now)
        return True, None


def enforce_rate_limit(key: str) -> None:
    """Raise HTTP 429 when the caller is over the limit."""
    allowed, message = check_rate_limit(key)
    if not allowed:
        logger.info("Rate limit hit for %s", key)
        raise HTTPException(status_code=429, detail=message)


def reset(key: str | None = None) -> None:
    """Test helper: clear one key or the whole window."""
    with _lock:
        if key is None:
            _events.clear()
        else:
            _events.pop(key, None)
