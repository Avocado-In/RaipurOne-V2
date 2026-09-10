"""Telegram intake and citizen self-service.

Beyond registering complaints this now closes the citizen loop: a citizen can look up
their own complaints, rate resolved work, and reopen something that was not actually
fixed. Replay protection is durable (``public.telegram_updates``) rather than an
in-process set, so restarting the bot no longer risks duplicate complaints.
"""
import asyncio
import logging
import os
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import uuid4
from datetime import datetime, timezone

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from app.api.routes.ai import classify_complaint_text, recommend_worker_for_department
from app.api.routes.notifications import add_notification
from app.core.config import settings
from app.core.domain import InvalidStatusTransition
from app.services import audit, citizen_identity
from app.services.citizen_notify import short_reference
from app.services.rate_limit import check_rate_limit
from app.services.repository import SupabaseComplaintRepository

logger = logging.getLogger("raipurone.telegram")
LOCK_PATH = Path(__file__).resolve().parents[1] / ".telegram-bot.lock"

#: Conversation state: chat_id -> the message awaiting an optional photo. In memory by
#: design - it is a few seconds of dialogue, and losing it on restart only means the
#: citizen resends. Complaint de-duplication, which must survive restarts, is in Supabase.
_pending_messages: dict[int, Any] = {}
#: chat_id -> complaint id awaiting a 1-5 rating.
_awaiting_rating: dict[int, str] = {}

STATUS_LABELS = {
    "submitted": "🆕 Submitted",
    "assigned": "👷 Assigned",
    "in_progress": "🔧 In progress",
    "under_review": "🔍 Under review",
    "resolved": "✅ Resolved",
    "closed": "📁 Closed",
    "rejected": "❌ Rejected",
}


def _process_is_running(pid: int) -> bool:
    """Best-effort liveness check so a crash does not block restarts forever."""
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    except Exception:
        return True
    return True


def _acquire_lock() -> None:
    try:
        fd = os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(str(os.getpid()))
        return
    except FileExistsError:
        pass

    raw = LOCK_PATH.read_text(encoding="utf-8").strip() if LOCK_PATH.exists() else ""
    try:
        pid = int(raw)
    except ValueError:
        pid = -1

    if pid > 0 and _process_is_running(pid):
        raise SystemExit(f"Telegram bot already running (PID {pid}). Stop it before starting another instance.")

    # The previous run died without releasing the lock; reclaim it rather than requiring
    # someone to delete the file by hand.
    logger.warning("Removing stale lock file from dead PID %s", raw or "unknown")
    LOCK_PATH.unlink(missing_ok=True)
    _acquire_lock()


def _release_lock() -> None:
    try:
        LOCK_PATH.unlink()
    except FileNotFoundError:
        pass


def complaint_from_message(
    message: Any,
    repository: Any,
    image_content: bytes | None = None,
    image_filename: str = "telegram-photo.jpg",
) -> dict:
    text = (getattr(message, "text", None) or getattr(message, "caption", None) or "").strip()
    if not text:
        if image_content is not None:
            text = "Image complaint submitted from Telegram."
        else:
            raise ValueError("Please send a complaint description, optionally with a photo or location.")

    analysis = classify_complaint_text(text)
    recommendation = recommend_worker_for_department(analysis["category"], analysis["priority"])
    location = getattr(message, "location", None)
    now = datetime.now(timezone.utc).isoformat()
    chat_id = getattr(getattr(message, "chat", None), "id", None)
    message_id = getattr(message, "message_id", None)

    # Link the complaint to a citizen account so history and trust score have an owner.
    citizen = citizen_identity.get_or_create_citizen(chat_id) if chat_id is not None else None

    complaint = {
        "id": str(uuid4()),
        "citizen_user_id": (citizen or {}).get("id"),
        "citizen_name": (citizen or {}).get("username") or f"Telegram user {chat_id or 'unknown'}",
        "title": text[:120],
        "description": text,
        "category": analysis["category"],
        "department": recommendation.get("department") or analysis["category"],
        "department_id": None,
        "priority": analysis["priority"],
        "status": "submitted",
        "assigned_worker_id": None,
        "assigned_worker": None,
        "recommended_worker_id": None,
        "recommended_worker_payload": recommendation,
        "ai_analysis": analysis,
        "location_text": None,
        "location_lat": getattr(location, "latitude", None),
        "location_lng": getattr(location, "longitude", None),
        "source": "telegram",
        "telegram_chat_id": chat_id,
        "telegram_message_id": message_id,
        "submitted_at": now,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
        "closed_at": None,
        "resolution_summary": None,
    }
    logger.info("Persisting Telegram complaint %s for chat %s", complaint["id"], chat_id)
    saved = repository.create_complaint(complaint) or complaint
    if image_content is not None and hasattr(repository, "upload_complaint_image"):
        saved["image"] = repository.upload_complaint_image(saved["id"], image_content, image_filename)
    add_notification(
        "Telegram complaint received",
        f"New complaint {complaint['id']} received from Telegram.",
        "info",
        complaint["id"],
    )
    audit.record_change(
        "complaints",
        complaint["id"],
        "create:telegram",
        actor_user_id=(citizen or {}).get("id"),
        after={"status": "submitted", "category": complaint["category"], "priority": complaint["priority"]},
    )
    return saved


def _confirmation_text(complaint: dict) -> str:
    analysis = complaint.get("ai_analysis") or {}
    confidence = analysis.get("confidence")
    reference = short_reference(complaint.get("id"))
    lines = [
        f"✅ Complaint registered — {reference}",
        f"Category: {complaint.get('category')}"
        + (f" ({confidence:.0%} confidence)" if isinstance(confidence, (int, float)) else ""),
        f"Priority: {complaint.get('priority')}",
        f"Routed to: {complaint.get('department')}",
        "",
        "Use /status to track it. We will message you when it progresses.",
    ]
    return "\n".join(lines)


async def _send_registered(
    chat_id: int,
    message: Any,
    context: ContextTypes.DEFAULT_TYPE,
    image_content: bytes | None = None,
    image_filename: str = "telegram-photo.jpg",
) -> None:
    allowed, limit_message = check_rate_limit(f"telegram:{chat_id}")
    if not allowed:
        await context.bot.send_message(chat_id, f"⏳ {limit_message}")
        return
    repository = context.application.bot_data["complaint_repository"]
    complaint = complaint_from_message(message, repository, image_content, image_filename)
    await context.bot.send_message(chat_id, _confirmation_text(complaint))


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    if not chat:
        return
    citizen_identity.get_or_create_citizen(chat.id)
    await context.bot.send_message(
        chat.id,
        "👋 Welcome to RaipurOne.\n\n"
        "Send your civic issue in Hindi, English or Hinglish and I will route it to the "
        "right department.\n\n"
        "Commands:\n"
        "/status — track your complaints\n"
        "/rate — rate resolved work\n"
        "/reopen — reopen an unresolved complaint\n"
        "/help — how this works",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat:
        await context.bot.send_message(
            update.effective_chat.id,
            "📝 Send a description of the problem. I will ask if you want to attach a photo — "
            "send one, or reply /skip.\n\n"
            "You can also share your location so the crew can find the spot.\n\n"
            "/status — your recent complaints\n"
            "/rate — rate a resolved complaint\n"
            "/reopen — tell us it is still not fixed",
        )


async def skip_image(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    if not chat:
        return
    pending = _pending_messages.pop(chat.id, None)
    if pending is None:
        await context.bot.send_message(chat.id, "There is no pending complaint. Send an issue description first.")
        return
    try:
        await _send_registered(chat.id, pending, context)
    except Exception:
        logger.exception("Telegram complaint persistence failed")
        await context.bot.send_message(chat.id, "I could not register that complaint. Please try again later.")


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show this citizen their own recent complaints."""
    chat = update.effective_chat
    if not chat:
        return
    complaints = citizen_identity.complaints_for_chat(chat.id, limit=5)
    if not complaints:
        await context.bot.send_message(chat.id, "You have not submitted any complaints yet.")
        return

    lines = ["📋 Your recent complaints:\n"]
    for item in complaints:
        label = STATUS_LABELS.get(str(item.get("status")), str(item.get("status")))
        submitted = str(item.get("submitted_at") or "")[:10]
        lines.append(
            f"{short_reference(item.get('id'))} — {label}\n"
            f"   {str(item.get('title') or '')[:60]}\n"
            f"   {item.get('category')} · {item.get('priority')} · {submitted}"
        )
    await context.bot.send_message(chat.id, "\n\n".join(lines))


async def rate_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Ask the citizen to rate their most recently resolved complaint."""
    chat = update.effective_chat
    if not chat:
        return
    complaints = citizen_identity.complaints_for_chat(chat.id, limit=10)
    resolved = [c for c in complaints if str(c.get("status")) in {"resolved", "closed"}]
    if not resolved:
        await context.bot.send_message(chat.id, "You have no resolved complaints to rate yet.")
        return
    target = resolved[0]
    _awaiting_rating[chat.id] = str(target.get("id"))
    await context.bot.send_message(
        chat.id,
        f"⭐ How was the work on {short_reference(target.get('id'))}?\n"
        f"{str(target.get('title') or '')[:80]}\n\n"
        "Reply with a number from 1 (poor) to 5 (excellent).",
    )


async def reopen_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Let a citizen say a 'resolved' complaint is not actually fixed."""
    chat = update.effective_chat
    if not chat:
        return
    repository = context.application.bot_data["complaint_repository"]
    complaints = citizen_identity.complaints_for_chat(chat.id, limit=10)
    resolved = [c for c in complaints if str(c.get("status")) == "resolved"]
    if not resolved:
        await context.bot.send_message(chat.id, "You have no resolved complaints to reopen.")
        return

    target = resolved[0]
    citizen = citizen_identity.get_or_create_citizen(chat.id)
    try:
        repository.update_complaint(
            str(target.get("id")),
            {"status": "in_progress", "resolution_summary": "Reopened by citizen: issue not resolved."},
            actor_user_id=(citizen or {}).get("id"),
        )
    except InvalidStatusTransition as exc:
        await context.bot.send_message(chat.id, f"I could not reopen that complaint: {exc}")
        return
    except Exception:
        logger.exception("Reopen failed")
        await context.bot.send_message(chat.id, "I could not reopen that complaint. Please try again later.")
        return

    await context.bot.send_message(
        chat.id,
        f"🔄 {short_reference(target.get('id'))} has been reopened and sent back to the team.",
    )


async def _handle_rating(chat_id: int, text: str, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """Consume a pending 1-5 rating reply. Returns True when handled."""
    complaint_id = _awaiting_rating.get(chat_id)
    if not complaint_id:
        return False
    stripped = text.strip()
    if not stripped.isdigit() or not 1 <= int(stripped) <= 5:
        await context.bot.send_message(chat_id, "Please reply with a number from 1 to 5.")
        return True

    stars = int(stripped)
    _awaiting_rating.pop(chat_id, None)
    citizen = citizen_identity.get_or_create_citizen(chat_id)
    citizen_id = (citizen or {}).get("id")

    # There is no ratings table in the deployed database, so the rating is recorded as an
    # immutable audit event rather than silently dropped.
    audit.record_change(
        "complaints",
        complaint_id,
        "citizen_rating",
        actor_user_id=citizen_id,
        after={"stars": stars},
        metadata={"source": "telegram", "stars": stars},
    )
    if citizen_id:
        delta = (
            citizen_identity.TRUST_CONFIRMED_RESOLUTION
            if stars >= 3
            else citizen_identity.TRUST_FALSE_REPORT / 2
        )
        citizen_identity.adjust_trust(citizen_id, delta, f"rated {stars}/5")

    await context.bot.send_message(
        chat_id,
        f"🙏 Thank you. Your {stars}★ rating for {short_reference(complaint_id)} has been recorded.",
    )
    return True


async def receive_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    chat = update.effective_chat
    if not message or not chat:
        return
    # Durable replay protection, unlike the in-memory set this replaces.
    if not citizen_identity.claim_update(update.update_id, chat.id, message.message_id):
        return
    logger.info("Telegram update received: %s", update.update_id)
    try:
        if message.photo:
            photo = message.photo[-1]
            telegram_file = await context.bot.get_file(photo.file_id)
            image_content = bytes(await telegram_file.download_as_bytearray())
            image_filename = f"{message.message_id}.jpg"
            pending = _pending_messages.pop(chat.id, None)
            if pending is not None and not (message.caption or message.text):
                message = SimpleNamespace(
                    text=getattr(pending, "text", None),
                    caption=getattr(pending, "caption", None),
                    chat=chat,
                    message_id=message.message_id,
                    location=getattr(pending, "location", None),
                )
            await _send_registered(chat.id, message, context, image_content, image_filename)
            return

        if message.text and not message.text.startswith("/"):
            if await _handle_rating(chat.id, message.text, context):
                return
            answer = message.text.strip().lower()
            pending = _pending_messages.get(chat.id)
            if pending is not None and answer in {"no", "n", "nope", "skip", "nahi"}:
                _pending_messages.pop(chat.id, None)
                await _send_registered(chat.id, pending, context)
                return
            if pending is not None and answer in {"yes", "y", "ok", "okay", "haan", "ha"}:
                await context.bot.send_message(chat.id, "Okay. Please send the photo now. You can add an optional caption.")
                return
            _pending_messages[chat.id] = message
            await context.bot.send_message(
                chat.id,
                "📷 Would you like to add a photo to this complaint?\n"
                "Send the photo now, or reply no (or /skip) to register without one.",
            )
            return

        if message.location:
            _pending_messages[chat.id] = message
            await context.bot.send_message(
                chat.id,
                "📍 Location received. Now send a short description of the problem.",
            )
            return

        await context.bot.send_message(chat.id, "Please send an issue description, then choose whether to attach a photo.")
    except ValueError as exc:
        await context.bot.send_message(chat.id, str(exc))
    except Exception:
        logger.exception("Telegram complaint persistence failed")
        await context.bot.send_message(chat.id, "I could not register that complaint. Please try again later.")


async def run_bot() -> None:
    if not settings.telegram_bot_token:
        raise SystemExit("TELEGRAM_BOT_TOKEN is missing from the root .env file.")
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Telegram complaint registration.")

    repository = SupabaseComplaintRepository(strict=True)
    try:
        repository.ensure_complaint_image_bucket()
        repository.verify_telegram_schema()
    except Exception as exc:
        raise SystemExit(
            "Supabase storage or Telegram schema setup is missing. Run supabase/telegram_migration.sql first, then restart the bot."
        ) from exc

    application = Application.builder().token(settings.telegram_bot_token).build()
    application.bot_data["complaint_repository"] = repository
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("skip", skip_image))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("mycomplaints", status_command))
    application.add_handler(CommandHandler("rate", rate_command))
    application.add_handler(CommandHandler("reopen", reopen_command))
    application.add_handler(
        MessageHandler((filters.TEXT | filters.PHOTO | filters.LOCATION) & ~filters.COMMAND, receive_message)
    )

    await application.initialize()
    await application.updater.start_polling(allowed_updates=Update.ALL_TYPES)
    await application.start()
    me = await application.bot.get_me()
    logger.info("Telegram bot connected as @%s and is waiting for messages", me.username)
    try:
        await asyncio.Event().wait()
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    _acquire_lock()
    try:
        asyncio.run(run_bot())
    finally:
        _release_lock()


if __name__ == "__main__":
    main()
