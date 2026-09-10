"""Outbound messages to citizens on Telegram.

This closes the loop that was missing entirely: a citizen could report an issue and then
never hear anything again. The backend never contacted them, so the "citizen verifies
completion / citizen rates the work" journey in plan.md could not happen.

Messages go straight to the Telegram Bot API over HTTPS rather than through the running
bot process, so the API and the bot stay independent - the API can notify even when the
polling worker is down, and neither needs to import the other.

Sending is best-effort: a citizen who blocked the bot, or a network blip, must never make
an administrator's status update fail.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("raipurone.citizen_notify")

TELEGRAM_API = "https://api.telegram.org"

#: What the citizen reads for each lifecycle state. Written for a member of the public,
#: not an operator - no internal jargon, no raw ids.
_STATUS_MESSAGES: dict[str, str] = {
    "assigned": "👷 Your complaint has been assigned to the {department} team.",
    "in_progress": "🔧 Work has started on your complaint.",
    "under_review": "🔍 Your complaint is being reviewed before completion.",
    "resolved": (
        "✅ Your complaint has been marked resolved.\n"
        "If the issue is fixed, reply /rate to rate the work. "
        "If it is not fixed, reply /reopen and we will look again."
    ),
    "closed": "📁 Your complaint is now closed. Thank you for helping improve Raipur.",
    "rejected": "❌ Your complaint could not be taken forward. Reply /help if you think this is a mistake.",
}


def _enabled() -> bool:
    return bool(settings.telegram_bot_token)


def send_message(chat_id: int | str, text: str) -> bool:
    """Send one Telegram message. Returns whether it was delivered."""
    if not _enabled():
        logger.debug("Telegram token not configured; skipping citizen message")
        return False
    url = f"{TELEGRAM_API}/bot{settings.telegram_bot_token}/sendMessage"
    try:
        response = httpx.post(
            url,
            json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
            timeout=10,
        )
        if response.is_error:
            logger.warning(
                "Telegram sendMessage to %s failed: %s %s",
                chat_id,
                response.status_code,
                response.text[:200],
            )
            return False
        return True
    except httpx.HTTPError as exc:
        logger.warning("Telegram sendMessage to %s failed: %s", chat_id, exc)
        return False


def notify_status_change(complaint: dict[str, Any], status: str) -> bool:
    """Tell the citizen their complaint moved, if we know how to reach them."""
    chat_id = complaint.get("telegram_chat_id")
    if not chat_id:
        # Web-submitted complaints have no Telegram channel to reply on.
        return False

    template = _STATUS_MESSAGES.get(str(status).lower())
    if not template:
        return False

    reference = complaint.get("reference") or short_reference(complaint.get("id"))
    body = template.format(department=complaint.get("department") or "assigned")
    text = f"Complaint {reference}\n{complaint.get('title') or ''}\n\n{body}"
    delivered = send_message(chat_id, text)
    if delivered:
        logger.info("Notified citizen for complaint %s (%s)", complaint.get("id"), status)
    return delivered


def short_reference(complaint_id: Any) -> str:
    """A human-readable reference. A raw uuid is not something to read down a phone."""
    raw = str(complaint_id or "").replace("-", "").upper()
    return f"RPR-{raw[:6]}" if raw else "RPR-UNKNOWN"
