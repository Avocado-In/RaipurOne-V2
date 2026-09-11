import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from types import SimpleNamespace

import pytest

import app.telegram_bot as telegram_bot
from app.telegram_bot import complaint_from_message


class FakeRepository:
    def __init__(self):
        self.payloads = []

    def create_complaint(self, payload):
        self.payloads.append(payload)
        return payload


def test_telegram_complaint_is_written_with_supabase_fields(monkeypatch):
    repository = FakeRepository()
    monkeypatch.setattr(telegram_bot, "add_notification", lambda *args: {"id": "notification-1"})
    message = SimpleNamespace(
        text="Garbage is piling up near the market",
        caption=None,
        chat=SimpleNamespace(id=12345),
        message_id=77,
        location=None,
    )

    result = complaint_from_message(message, repository)

    assert result["source"] == "telegram"
    assert result["telegram_chat_id"] == 12345
    assert result["telegram_message_id"] == 77
    assert result["status"] == "submitted"
    assert result["assigned_worker_id"] is None
    assert result["department"]
    assert result["category"] in {"Sanitation", "Street Lights", "Water Supply", "Health care", "road", "Others"}
    assert result["priority"] in {"high", "medium"}
    assert "ai_analysis" in result
    assert result["ai_analysis"]["category"] == result["category"]
    from uuid import UUID
    UUID(repository.payloads[0]["id"])


def test_telegram_complaint_accepts_location(monkeypatch):
    repository = FakeRepository()
    monkeypatch.setattr(telegram_bot, "add_notification", lambda *args: {"id": "notification-2"})
    message = SimpleNamespace(
        text="Water leak near the school",
        caption=None,
        chat=SimpleNamespace(id=22),
        message_id=8,
        location=SimpleNamespace(latitude=21.25, longitude=81.63),
    )

    result = complaint_from_message(message, repository)

    assert result["location_lat"] == 21.25
    assert result["location_lng"] == 81.63


def test_telegram_complaint_requires_text_or_caption():
    with pytest.raises(ValueError):
        complaint_from_message(SimpleNamespace(text=None, caption=None, chat=None, message_id=1, location=None), FakeRepository())






def test_photo_complaint_uploads_attachment(monkeypatch):
    repository = FakeRepository()
    uploaded = {}
    repository.upload_complaint_image = lambda complaint_id, content, filename: uploaded.update(
        complaint_id=complaint_id, content=content, filename=filename
    ) or {"storage_path": f"{complaint_id}/{filename}"}
    monkeypatch.setattr(telegram_bot, "add_notification", lambda *args: {"id": "notification-photo"})
    message = SimpleNamespace(
        text=None,
        caption="Broken road shown in this photo",
        chat=SimpleNamespace(id=123),
        message_id=99,
        location=None,
    )

    result = complaint_from_message(message, repository, b"jpeg-bytes", "99.jpg")

    assert result["image"]["storage_path"].endswith("/99.jpg")
    assert uploaded["content"] == b"jpeg-bytes"
    assert uploaded["complaint_id"] == result["id"]

# --- Replay protection and commands ----------------------------------------
#
# "A replayed Telegram update must not create a second complaint" is an acceptance
# criterion, and Telegram genuinely redelivers updates when a poll is interrupted, so
# the guard is exercised here rather than trusted.

class _RecordingBot:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat_id, text, *args, **kwargs):
        self.sent.append((chat_id, text))


def _update(update_id: int, text: str, chat_id: int = 4242, message_id: int = 9):
    message = SimpleNamespace(
        text=text,
        caption=None,
        photo=None,
        location=None,
        chat=SimpleNamespace(id=chat_id),
        message_id=message_id,
    )
    return SimpleNamespace(
        update_id=update_id,
        effective_message=message,
        effective_chat=SimpleNamespace(id=chat_id),
    )


def test_replayed_update_is_ignored_without_touching_the_complaint_flow(monkeypatch):
    claimed: list[int] = []

    def fake_claim(update_id, chat_id=None, message_id=None):
        # First delivery wins; Telegram's redelivery of the same id is refused.
        if update_id in claimed:
            return False
        claimed.append(update_id)
        return True

    monkeypatch.setattr(telegram_bot.citizen_identity, "claim_update", fake_claim)
    bot = _RecordingBot()
    context = SimpleNamespace(bot=bot)

    asyncio.run(telegram_bot.receive_message(_update(1001, "Drain is overflowing"), context))
    first_round = len(bot.sent)
    assert first_round == 1  # the photo prompt

    asyncio.run(telegram_bot.receive_message(_update(1001, "Drain is overflowing"), context))

    assert len(bot.sent) == first_round, "replayed update produced a second reply"
    assert claimed == [1001]


def test_claim_update_treats_a_duplicate_key_as_already_handled(monkeypatch):
    from app.services import citizen_identity

    monkeypatch.setattr(citizen_identity, "_configured", lambda: True)
    monkeypatch.setattr(citizen_identity, "_base", lambda: "https://example.test/rest/v1")
    monkeypatch.setattr(citizen_identity, "_headers", lambda *args, **kwargs: {})

    responses = iter([201, 409])
    monkeypatch.setattr(
        citizen_identity.httpx,
        "post",
        lambda *args, **kwargs: SimpleNamespace(status_code=next(responses), text=""),
    )

    assert citizen_identity.claim_update(55, 1, 2) is True
    assert citizen_identity.claim_update(55, 1, 2) is False


def test_claim_update_fails_open_when_the_dedup_table_is_unreachable(monkeypatch):
    """A dedup outage must not reject every citizen's complaint."""
    from app.services import citizen_identity

    monkeypatch.setattr(citizen_identity, "_configured", lambda: True)
    monkeypatch.setattr(citizen_identity, "_base", lambda: "https://example.test/rest/v1")
    monkeypatch.setattr(citizen_identity, "_headers", lambda *args, **kwargs: {})

    def boom(*args, **kwargs):
        raise citizen_identity.httpx.ConnectError("dedup table unreachable")

    monkeypatch.setattr(citizen_identity.httpx, "post", boom)

    assert citizen_identity.claim_update(56, 1, 2) is True


def test_start_and_help_commands_reply():
    bot = _RecordingBot()
    context = SimpleNamespace(bot=bot)
    update = _update(2001, "/start")

    asyncio.run(telegram_bot.start(update, context))
    asyncio.run(telegram_bot.help_command(update, context))

    assert len(bot.sent) == 2
    assert all(text.strip() for _, text in bot.sent)


# --- the photo/location dialogue -------------------------------------------
#
# These drive receive_message rather than complaint_from_message, because the bugs they
# cover lived in the conversation state, not in the record builder: everything below
# used to be dropped on the floor while the citizen was told their complaint was
# registered.


class _Recorder:
    """Stands in for the Telegram bot, the repository and the network around them."""

    def __init__(self, monkeypatch):
        self.sent = []
        self.payloads = []
        monkeypatch.setattr(telegram_bot, "add_notification", lambda *a, **k: {"id": "n"})
        monkeypatch.setattr(telegram_bot.citizen_identity, "claim_update", lambda *a, **k: True)
        monkeypatch.setattr(
            telegram_bot.citizen_identity, "get_or_create_citizen", lambda cid: {"id": "c1", "username": "u"}
        )
        monkeypatch.setattr(telegram_bot.audit, "record_change", lambda *a, **k: None)
        telegram_bot._pending_messages.clear()

    def create_complaint(self, payload):
        self.payloads.append(payload)
        return payload

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append(text)

    @property
    def context(self):
        return SimpleNamespace(
            bot=self,
            application=SimpleNamespace(bot_data={"complaint_repository": self}),
        )


def _dialogue_chat(chat_id=4242):
    return SimpleNamespace(id=chat_id)


def _dialogue_update(message, chat):
    return SimpleNamespace(effective_message=message, effective_chat=chat, update_id=id(message))


def _dialogue_text(text, chat, message_id):
    return SimpleNamespace(
        text=text, caption=None, photo=None, chat=chat, message_id=message_id, location=None
    )


def _deliver_dialogue(recorder, messages, chat):
    async def run():
        for message in messages:
            await telegram_bot.receive_message(_dialogue_update(message, chat), recorder.context)

    asyncio.run(run())


def test_location_survives_the_description_that_follows_it(monkeypatch):
    """The bot asks for the description after the pin; that reply used to erase the pin."""
    recorder = _Recorder(monkeypatch)
    chat = _dialogue_chat()
    pin = SimpleNamespace(
        text=None, caption=None, photo=None, chat=chat, message_id=1,
        location=SimpleNamespace(latitude=21.25, longitude=81.63),
    )
    _deliver_dialogue(recorder, [
        pin,
        _dialogue_text("Bada gaddha hai is sadak par", chat, 2),
        _dialogue_text("no", chat, 3),
    ], chat)

    assert len(recorder.payloads) == 1
    assert recorder.payloads[0]["location_lat"] == 21.25
    assert recorder.payloads[0]["location_lng"] == 81.63


def test_second_description_line_is_added_not_replaced(monkeypatch):
    """Two lines of detail are one complaint; the first used to be thrown away."""
    recorder = _Recorder(monkeypatch)
    chat = _dialogue_chat()
    _deliver_dialogue(recorder, [
        _dialogue_text("Sadak par gaddha hai", chat, 1),
        _dialogue_text("bus stand ke paas", chat, 2),
        _dialogue_text("no", chat, 3),
    ], chat)

    assert len(recorder.payloads) == 1
    description = recorder.payloads[0]["description"]
    assert "Sadak par gaddha hai" in description
    assert "bus stand ke paas" in description


def test_repeated_identical_text_is_not_duplicated(monkeypatch):
    """A citizen resending the same line is impatience, not extra detail."""
    recorder = _Recorder(monkeypatch)
    chat = _dialogue_chat()
    _deliver_dialogue(recorder, [
        _dialogue_text("Street light kharab hai", chat, 1),
        _dialogue_text("Street light kharab hai", chat, 2),
        _dialogue_text("no", chat, 3),
    ], chat)

    assert recorder.payloads[0]["description"].count("Street light kharab hai") == 1


def test_captioned_photo_keeps_the_earlier_description_and_location(monkeypatch):
    """A caption used to replace, rather than add to, what was already sent."""
    recorder = _Recorder(monkeypatch)
    chat = _dialogue_chat()

    class _File:
        async def download_as_bytearray(self):
            return bytearray(b"jpeg-bytes")

    async def get_file(file_id):
        return _File()

    recorder.get_file = get_file
    pin = SimpleNamespace(
        text=None, caption=None, photo=None, chat=chat, message_id=1,
        location=SimpleNamespace(latitude=21.1, longitude=81.6),
    )
    photo = SimpleNamespace(
        text=None, caption="Yahan par", photo=[SimpleNamespace(file_id="f1")],
        chat=chat, message_id=3, location=None,
    )
    _deliver_dialogue(recorder, [pin, _dialogue_text("Nali block hai", chat, 2), photo], chat)

    assert len(recorder.payloads) == 1
    saved = recorder.payloads[0]
    assert "Nali block hai" in saved["description"]
    assert "Yahan par" in saved["description"]
    assert saved["location_lat"] == 21.1
