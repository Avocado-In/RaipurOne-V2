"""Telegram citizen identity, update de-duplication, and trust score.

Two problems this solves:

1. **Anonymous complaints.** Every Telegram complaint was stored with
   ``citizen_user_id = None`` and a display name of ``Telegram user <chat_id>``, so a
   citizen could never be shown their own history and trust score had nothing to attach
   to. Telegram users are now given a row in ``public.users`` with the username
   ``tg_<chat_id>``. That needs no schema change - the ``users`` table has no Telegram
   column and adding one requires DDL this service cannot issue.

2. **Restart-unsafe de-duplication.** Replay protection lived in an in-process
   ``set[int]``, so restarting the bot let Telegram redeliver updates and create duplicate
   complaints. The ``telegram_updates`` table was created for exactly this in
   ``telegram_migration.sql`` and had never been referenced by any code. Its primary key
   makes a repeat insert fail, which is the durable "already handled" signal.
"""
from __future__ import annotations

import logging
from typing import Any

from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger("raipurone.identity")

TRUST_MIN = 0.0
TRUST_MAX = 100.0
#: Confirming a real fix earns trust; a report withdrawn as false costs more than it earns,
#: so repeated false reporting degrades faster than it can be farmed back.
TRUST_CONFIRMED_RESOLUTION = 2.0
TRUST_FALSE_REPORT = -10.0
#: Below this, a citizen's non-urgent reports are flagged for manual verification.
TRUST_FLAG_THRESHOLD = 40.0


def _base() -> str:
    return settings.supabase_url.rstrip("/") + "/rest/v1"


def _headers(prefer: str = "return=representation") -> dict[str, str]:
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


def _configured() -> bool:
    return bool(settings.supabase_url and (settings.supabase_service_role_key or settings.supabase_anon_key))


# --- Identity ---------------------------------------------------------------

def telegram_username(chat_id: int | str) -> str:
    return f"tg_{chat_id}"


def remember_subscriber(chat_id: int | str, username: str | None = None) -> None:
    """Record that this chat is reachable, so civic broadcasts include it.

    Every path that identifies a Telegram citizen calls this, which is the point: a
    person who pressed /start and never filed anything has still opened a conversation
    with the bot and would expect a water-cut notice. Deriving the audience from
    complaints alone quietly left them out.

    Best-effort - failing to note a subscriber must never break the reply the citizen is
    waiting for.
    """
    if not _configured():
        return
    try:
        httpx.post(
            f"{_base()}/telegram_subscribers",
            headers={**_headers(prefer="resolution=merge-duplicates,return=minimal")},
            json={
                "chat_id": int(chat_id),
                "username": username or telegram_username(chat_id),
                "last_seen": datetime.now(timezone.utc).isoformat(),
                "is_active": True,
            },
            timeout=10,
        )
    except (httpx.HTTPError, TypeError, ValueError) as exc:
        logger.warning("Could not record subscriber %s: %s", chat_id, exc)


def get_or_create_citizen(chat_id: int | str, display_name: str | None = None) -> dict[str, Any] | None:
    """Return the ``users`` row for this Telegram chat, creating it on first contact."""
    if not _configured():
        return None
    username = telegram_username(chat_id)
    remember_subscriber(chat_id, username)
    try:
        found = httpx.get(
            f"{_base()}/users",
            headers=_headers(),
            params={"select": "*", "username": f"eq.{username}", "limit": "1"},
            timeout=10,
        ).json()
        if found:
            return found[0]

        response = httpx.post(
            f"{_base()}/users",
            headers=_headers(),
            json={
                "username": username,
                # Telegram identity is proven by the chat itself; there is no password
                # login for these accounts, so no usable hash is stored.
                "password_hash": "!telegram-no-password",
                "role": "citizen",
                "trust_score": TRUST_MAX,
                "is_active": True,
            },
            timeout=10,
        )
        if response.is_error:
            logger.warning("Could not create citizen for chat %s: %s", chat_id, response.text[:200])
            return None
        rows = response.json()
        created = rows[0] if isinstance(rows, list) else rows
        logger.info("Registered Telegram citizen %s", username)
        return created
    except httpx.HTTPError as exc:
        logger.warning("Citizen lookup failed for chat %s: %s", chat_id, exc)
        return None


def adjust_trust(user_id: str, delta: float, reason: str) -> float | None:
    """Move a citizen's trust score, clamped to [0, 100]. Returns the new value."""
    if not _configured() or not user_id:
        return None
    try:
        rows = httpx.get(
            f"{_base()}/users",
            headers=_headers(),
            params={"select": "trust_score", "id": f"eq.{user_id}", "limit": "1"},
            timeout=10,
        ).json()
        if not rows:
            return None
        current = float(rows[0].get("trust_score") or TRUST_MAX)
        updated = max(TRUST_MIN, min(TRUST_MAX, current + delta))
        httpx.patch(
            f"{_base()}/users",
            headers=_headers("return=minimal"),
            params={"id": f"eq.{user_id}"},
            json={"trust_score": updated},
            timeout=10,
        )
        logger.info("Trust %s: %.1f -> %.1f (%s)", user_id, current, updated, reason)
        return updated
    except httpx.HTTPError as exc:
        logger.warning("Trust update failed for %s: %s", user_id, exc)
        return None


def is_flagged(user: dict[str, Any] | None) -> bool:
    if not user:
        return False
    try:
        return float(user.get("trust_score") or TRUST_MAX) < TRUST_FLAG_THRESHOLD
    except (TypeError, ValueError):
        return False


# --- Update de-duplication --------------------------------------------------

def claim_update(update_id: int, chat_id: int | None = None, message_id: int | None = None) -> bool:
    """Record a Telegram update id. ``False`` means it was already handled.

    Survives restarts, unlike the in-memory set this replaces. If the table is missing or
    unreachable the update is allowed through - refusing every complaint because the
    de-duplication table is down would be worse than a rare duplicate.
    """
    if not _configured():
        return True
    try:
        response = httpx.post(
            f"{_base()}/telegram_updates",
            headers=_headers("return=minimal"),
            json={"update_id": update_id, "chat_id": chat_id, "message_id": message_id},
            timeout=10,
        )
        if response.status_code in (200, 201, 204):
            return True
        if response.status_code == 409:  # duplicate primary key
            logger.info("Telegram update %s already handled; skipping", update_id)
            return False
        logger.warning("Update claim %s returned %s: %s", update_id, response.status_code, response.text[:150])
        return True
    except httpx.HTTPError as exc:
        logger.warning("Update claim failed for %s: %s", update_id, exc)
        return True


# --- Citizen complaint history ---------------------------------------------

def complaints_for_chat(chat_id: int | str, limit: int = 5) -> list[dict[str, Any]]:
    """Most recent complaints from this Telegram chat, newest first."""
    if not _configured():
        return []
    try:
        return httpx.get(
            f"{_base()}/complaints",
            headers=_headers(),
            params={
                "select": "id,title,status,category,priority,submitted_at,department_id",
                "telegram_chat_id": f"eq.{chat_id}",
                "order": "submitted_at.desc",
                "limit": str(limit),
            },
            timeout=10,
        ).json()
    except httpx.HTTPError as exc:
        logger.warning("Complaint history failed for chat %s: %s", chat_id, exc)
        return []
