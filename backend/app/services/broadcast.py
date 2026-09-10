"""Civic announcements sent out to citizens on Telegram.

The audience is not a mailing list anyone signed up for: it is everyone who has actually
filed a complaint through the R1 bot. Their chat id is already on the complaint, which is
the only reason we are able to reach them at all - and the only justification for doing
so, since they opened that conversation themselves.

Anything that never reached us on Telegram has no chat to answer on, so a web-filed
complaint contributes no recipient. There is deliberately no other channel here: FCM and
WhatsApp were offered by the dashboard but had nothing behind them, and a button that
claims to have messaged a city and did nothing is worse than no button.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import settings
from app.services.citizen_notify import send_message

logger = logging.getLogger("raipurone.broadcast")

#: Telegram allows roughly 30 messages a second to different chats. Staying well under
#: that costs a few seconds on a send and avoids a 429 that would drop real recipients.
_MESSAGES_PER_SECOND = 20

#: A broadcast reaches members of the public and cannot be recalled. Refusing an
#: implausibly large audience is a cheap guard against a bad query sending to everyone.
MAX_RECIPIENTS = 5000


class BroadcastUnavailable(RuntimeError):
    """Supabase is unreachable, or the broadcasts table has not been created."""


@dataclass
class BroadcastResult:
    recipients: int
    delivered: int
    failed: int
    failed_chat_ids: list[int] = field(default_factory=list)


def _headers() -> dict[str, str]:
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _request(method: str, path: str, params: dict[str, str] | None = None, payload: Any = None) -> Any:
    if not settings.supabase_url:
        raise BroadcastUnavailable("Supabase is not configured")
    try:
        response = httpx.request(
            method,
            f"{settings.supabase_url.rstrip('/')}/rest/v1{path}",
            headers=_headers(),
            params=params,
            json=payload,
            timeout=20.0,
        )
    except httpx.HTTPError as exc:
        raise BroadcastUnavailable(f"Supabase unreachable: {exc}") from exc
    if response.status_code == 404 or "PGRST205" in response.text:
        raise BroadcastUnavailable(
            "The broadcasts table does not exist. "
            "Run supabase/broadcasts_migration.sql against the project database."
        )
    if response.is_error:
        raise BroadcastUnavailable(f"Supabase {response.status_code}: {response.text[:300]}")
    return response.json()


# --- Audience ---------------------------------------------------------------

def reachable_chat_ids() -> list[int]:
    """Every distinct Telegram chat that has filed a complaint through R1."""
    rows = _request(
        "GET",
        "/complaints",
        params={"select": "telegram_chat_id", "telegram_chat_id": "not.is.null"},
    )
    seen: dict[int, None] = {}
    for row in rows or []:
        chat_id = row.get("telegram_chat_id")
        if chat_id is None:
            continue
        try:
            seen[int(chat_id)] = None
        except (TypeError, ValueError):
            continue
    return list(seen)


def audience_size() -> int:
    return len(reachable_chat_ids())


# --- Sending ----------------------------------------------------------------

_PRIORITY_PREFIX = {
    "critical": "🚨",
    "high": "⚠️",
    "medium": "📢",
    "low": "ℹ️",
}


def compose(title: str, message: str, priority: str) -> str:
    """What the citizen actually reads. No internal ids, no category codes."""
    prefix = _PRIORITY_PREFIX.get(str(priority).lower(), "📢")
    clean_title = title.strip()
    # Templates already start with their own emoji; a second one reads like a glitch.
    if clean_title and not clean_title[0].isalnum():
        prefix = ""
    heading = f"{prefix} {clean_title}".strip()
    return f"{heading}\n\n{message.strip()}\n\n— Raipur Nagar Nigam"


def send_broadcast(title: str, message: str, priority: str = "medium") -> BroadcastResult:
    """Deliver one announcement to every reachable citizen. Never raises on a bad chat."""
    if not settings.telegram_bot_token:
        raise BroadcastUnavailable("TELEGRAM_BOT_TOKEN is not configured")

    chat_ids = reachable_chat_ids()
    if len(chat_ids) > MAX_RECIPIENTS:
        raise BroadcastUnavailable(
            f"Refusing to send to {len(chat_ids)} recipients (limit {MAX_RECIPIENTS})."
        )

    text = compose(title, message, priority)
    delivered = 0
    failed: list[int] = []

    for index, chat_id in enumerate(chat_ids):
        # A citizen who blocked the bot, or deleted their account, must not stop the
        # rest of the city being told.
        if send_message(chat_id, text):
            delivered += 1
        else:
            failed.append(chat_id)
        if (index + 1) % _MESSAGES_PER_SECOND == 0:
            time.sleep(1)

    logger.info(
        "Broadcast '%s' delivered to %d of %d citizens", title, delivered, len(chat_ids)
    )
    return BroadcastResult(
        recipients=len(chat_ids), delivered=delivered, failed=len(failed), failed_chat_ids=failed
    )


# --- Record -----------------------------------------------------------------

def record(
    title: str,
    message: str,
    category: str,
    priority: str,
    result: BroadcastResult,
    sent_by: str | None = None,
) -> dict[str, Any]:
    payload = {
        "title": title,
        "message": message,
        "category": category,
        "priority": priority,
        "recipients": result.recipients,
        "delivered": result.delivered,
        "failed": result.failed,
        "sent_by": sent_by or None,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    data = _request("POST", "/broadcasts", payload=payload)
    return data[0] if isinstance(data, list) else data


def history(limit: int = 25) -> list[dict[str, Any]]:
    return _request(
        "GET",
        "/broadcasts",
        params={"select": "*", "order": "sent_at.desc", "limit": str(limit)},
    ) or []
