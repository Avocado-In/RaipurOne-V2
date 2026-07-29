from app.api.routes import notifications as notifications_routes


def test_add_notification_uses_the_configured_repository(monkeypatch):
    created = {}

    class DummyRepository:
        def create_notification(self, title, message, severity, complaint_id):
            created["payload"] = (title, message, severity, complaint_id)
            return {
                "id": "ntf-1",
                "title": title,
                "message": message,
                "severity": severity,
                "complaint_id": complaint_id,
                "created_at": "2026-07-22T00:00:00Z",
            }

    monkeypatch.setattr(notifications_routes, "get_notification_repository", lambda: DummyRepository())

    result = notifications_routes.add_notification("Bot update", "Telegram complaint saved", "info", "abc-123")

    assert result["title"] == "Bot update"
    assert result["message"] == "Telegram complaint saved"
    assert created["payload"] == ("Bot update", "Telegram complaint saved", "info", "abc-123")
