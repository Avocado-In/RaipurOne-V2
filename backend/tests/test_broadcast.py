"""Civic broadcasts: who they reach, and who is allowed to send one.

Every test here stubs the Telegram call. A broadcast goes to members of the public and
cannot be recalled, so the suite must never be one bad patch away from messaging a city.
"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import create_access_token  # noqa: E402
from app.main import app  # noqa: E402
from app.services import broadcast  # noqa: E402

client = TestClient(app)

CITIZENS = [111, 222, 333]


def headers_for(role: str) -> dict[str, str]:
    token = create_access_token("00000000-0000-0000-0000-0000000000aa", f"test-{role}", role)
    return {"Authorization": f"Bearer {token['access_token']}"}


@pytest.fixture
def wired(monkeypatch):
    """Three reachable citizens, a Telegram token, and no message actually leaving."""
    sent: list[tuple[int, str]] = []

    monkeypatch.setattr(broadcast.settings, "telegram_bot_token", "test-token")
    monkeypatch.setattr(broadcast, "reachable_chat_ids", lambda: list(CITIZENS))
    monkeypatch.setattr(
        broadcast, "send_message", lambda chat_id, text: sent.append((chat_id, text)) or True
    )
    monkeypatch.setattr(broadcast, "record", lambda *args, **kwargs: {"id": "bc-1"})
    return sent


# --- The message a citizen reads --------------------------------------------

def test_compose_marks_priority_and_signs_off():
    text = broadcast.compose("Water cut tomorrow", "Storage advised.", "critical")
    assert text.startswith("🚨 Water cut tomorrow")
    assert "Storage advised." in text
    assert text.endswith("— Raipur Nagar Nigam")


def test_compose_does_not_stack_a_second_emoji_on_a_template():
    # The quick templates already open with their own emoji.
    text = broadcast.compose("💧 Water Supply Interruption", "Details.", "medium")
    assert text.startswith("💧 Water Supply Interruption")
    assert "📢" not in text


def test_compose_carries_no_internal_identifiers():
    text = broadcast.compose("Notice", "Body", "low")
    for jargon in ("complaint_id", "chat_id", "uuid", "priority="):
        assert jargon not in text


# --- Delivery ---------------------------------------------------------------

def test_a_broadcast_reaches_every_citizen_once(wired):
    result = broadcast.send_broadcast("Notice", "Body text", "medium")
    assert result.recipients == 3
    assert result.delivered == 3
    assert result.failed == 0
    assert [chat_id for chat_id, _ in wired] == CITIZENS


def test_one_blocked_citizen_does_not_stop_the_others(monkeypatch, wired):
    # send_message returns False for a chat that blocked the bot.
    monkeypatch.setattr(broadcast, "send_message", lambda chat_id, text: chat_id != 222)
    result = broadcast.send_broadcast("Notice", "Body text", "medium")
    assert result.delivered == 2
    assert result.failed == 1
    assert result.failed_chat_ids == [222]


def test_sending_without_a_telegram_token_is_refused(monkeypatch, wired):
    monkeypatch.setattr(broadcast.settings, "telegram_bot_token", "")
    with pytest.raises(broadcast.BroadcastUnavailable):
        broadcast.send_broadcast("Notice", "Body text", "medium")


def test_an_implausibly_large_audience_is_refused(monkeypatch, wired):
    monkeypatch.setattr(
        broadcast, "reachable_chat_ids", lambda: list(range(broadcast.MAX_RECIPIENTS + 1))
    )
    with pytest.raises(broadcast.BroadcastUnavailable, match="Refusing to send"):
        broadcast.send_broadcast("Notice", "Body text", "medium")


def test_the_same_citizen_is_not_messaged_twice(monkeypatch):
    """Chat ids come off complaints, and one person files many - dedupe or spam them."""
    rows = [{"telegram_chat_id": 111}, {"telegram_chat_id": 111}, {"telegram_chat_id": 222}]
    monkeypatch.setattr(broadcast, "_request", lambda *args, **kwargs: rows)
    assert sorted(broadcast.reachable_chat_ids()) == [111, 222]


# --- Who may send -----------------------------------------------------------

def test_broadcasting_requires_authentication():
    response = client.post("/notifications/send", json={"title": "Hi", "message": "Hello all"})
    assert response.status_code == 401


def test_a_worker_cannot_broadcast_to_the_city(wired):
    response = client.post(
        "/notifications/send",
        headers=headers_for("worker"),
        json={"title": "Hi", "message": "Hello all"},
    )
    assert response.status_code == 403
    assert wired == []


def test_an_administrator_can_broadcast(wired):
    response = client.post(
        "/notifications/send",
        headers=headers_for("admin"),
        json={"title": "Water cut", "message": "Supply is off tomorrow."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sent_count"] == 3
    assert body["recipients"] == 3
    assert len(wired) == 3


def test_an_empty_audience_is_reported_rather_than_called_a_success(monkeypatch, wired):
    monkeypatch.setattr(broadcast, "reachable_chat_ids", lambda: [])
    response = client.post(
        "/notifications/send",
        headers=headers_for("admin"),
        json={"title": "Water cut", "message": "Supply is off tomorrow."},
    )
    assert response.status_code == 409
    assert "no one to broadcast to" in response.json()["detail"]


def test_a_too_short_message_is_rejected_before_anything_is_sent(wired):
    response = client.post(
        "/notifications/send", headers=headers_for("admin"), json={"title": "Hi", "message": "x"}
    )
    assert response.status_code == 422
    assert wired == []


# --- Audience sources -------------------------------------------------------

def test_the_audience_includes_people_who_only_pressed_start(monkeypatch):
    """A chat that never filed anything is still reachable and must be included."""
    def fake_request(method, path, params=None, payload=None):
        if path == "/telegram_subscribers":
            return [{"chat_id": 111}, {"chat_id": 999}]  # 999 has never complained
        return [{"telegram_chat_id": 111}, {"telegram_chat_id": 222}]

    monkeypatch.setattr(broadcast, "_request", fake_request)
    assert sorted(broadcast.reachable_chat_ids()) == [111, 222, 999]


def test_a_missing_subscriber_table_falls_back_to_complaints(monkeypatch):
    """A deployment that has not run the migration must still be able to broadcast."""
    def fake_request(method, path, params=None, payload=None):
        if path == "/telegram_subscribers":
            raise broadcast.BroadcastUnavailable("relation does not exist")
        return [{"telegram_chat_id": 222}]

    monkeypatch.setattr(broadcast, "_request", fake_request)
    assert broadcast.reachable_chat_ids() == [222]
