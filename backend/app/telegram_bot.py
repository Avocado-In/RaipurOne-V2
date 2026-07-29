"""Single-process Telegram intake service with an optional photo step."""
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
from app.services.repository import SupabaseComplaintRepository

logger = logging.getLogger("raipurone.telegram")
LOCK_PATH = Path(__file__).resolve().parents[1] / ".telegram-bot.lock"
_seen_updates: set[int] = set()
_pending_messages: dict[int, Any] = {}


def _acquire_lock() -> None:
    try:
        fd = os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(str(os.getpid()))
    except FileExistsError:
        pid = LOCK_PATH.read_text(encoding="utf-8").strip() if LOCK_PATH.exists() else "unknown"
        raise SystemExit(f"Telegram bot already running (PID {pid}). Stop it before starting another instance.")


def _release_lock() -> None:
    try:
        LOCK_PATH.unlink()
    except FileNotFoundError:
        pass


def complaint_from_message(message: Any, repository: Any, image_content: bytes | None = None, image_filename: str = "telegram-photo.jpg") -> dict:
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
    complaint = {
        "id": str(uuid4()),
        "citizen_user_id": None,
        "citizen_name": f"Telegram user {chat_id or 'unknown'}",
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
    add_notification("Telegram complaint received", f"New complaint {complaint['id']} received from Telegram.", "info", complaint["id"])
    return saved


async def _send_registered(chat_id: int, message: Any, context: ContextTypes.DEFAULT_TYPE, image_content: bytes | None = None, image_filename: str = "telegram-photo.jpg") -> None:
    repository = context.application.bot_data["complaint_repository"]
    complaint = complaint_from_message(message, repository, image_content, image_filename)
    await context.bot.send_message(chat_id, f"Complaint registered in Supabase.\nID: {complaint['id']}\nStatus: {complaint['status']}")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat:
        await context.bot.send_message(update.effective_chat.id, "Welcome to RaipurOne. Send your civic issue first. I will ask whether you want to attach an image.")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat:
        await context.bot.send_message(update.effective_chat.id, "Send your issue description. I will then ask: 'Would you like to add an image?' Send a photo, or reply /skip to register without one.")


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


async def receive_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    chat = update.effective_chat
    if not message or not chat:
        return
    if update.update_id in _seen_updates:
        return
    _seen_updates.add(update.update_id)
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
            answer = message.text.strip().lower()
            pending = _pending_messages.get(chat.id)
            if pending is not None and answer in {"no", "n", "nope", "skip"}:
                _pending_messages.pop(chat.id, None)
                await _send_registered(chat.id, pending, context)
                return
            if pending is not None and answer in {"yes", "y", "ok", "okay"}:
                await context.bot.send_message(chat.id, "Okay. Please send the photo now. You can add an optional caption.")
                return
            _pending_messages[chat.id] = message
            await context.bot.send_message(chat.id, "Would you like to add an image to this complaint? Send the photo now, or reply yes/no (or /skip).")
            return

        await context.bot.send_message(chat.id, "Please send an issue description, then choose whether to attach an image.")
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
        raise SystemExit("Supabase storage or Telegram schema setup is missing. Run supabase/telegram_migration.sql first, then restart the bot.") from exc
    application = Application.builder().token(settings.telegram_bot_token).build()
    application.bot_data["complaint_repository"] = repository
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("skip", skip_image))
    application.add_handler(MessageHandler((filters.TEXT | filters.PHOTO | filters.LOCATION) & ~filters.COMMAND, receive_message))

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
