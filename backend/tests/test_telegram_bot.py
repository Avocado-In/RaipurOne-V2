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