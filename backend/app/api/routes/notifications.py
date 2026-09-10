import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, List

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger("raipurone.notifications")
router = APIRouter()


class NotificationRepository:
    def create_notification(self, title: str, message: str, severity: str, complaint_id: str | None = None) -> dict:
        return {"id": f"NTF-{int(datetime.now(timezone.utc).timestamp() * 1000)}", "title": title, "message": message, "severity": severity, "complaint_id": complaint_id, "created_at": datetime.now(timezone.utc).isoformat()}


def _as_uuid(value: Any) -> str | None:
    """The notifications.complaint_id column is a uuid FK; legacy demo ids are not."""
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        return None


class SupabaseNotificationRepository(NotificationRepository):
    """Maps the API's `severity` wording onto the deployed `notifications.type` column."""

    def __init__(self) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("Supabase notification configuration is missing")
        self.url = settings.supabase_url.rstrip("/") + "/rest/v1/notifications"
        self.headers = {"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}", "Content-Type": "application/json", "Prefer": "return=representation"}

    @staticmethod
    def _to_api(row: dict) -> dict:
        return {
            "id": row.get("id"),
            "title": row.get("title"),
            "message": row.get("message"),
            "severity": row.get("type") or "info",
            "type": row.get("type") or "info",
            "complaint_id": row.get("complaint_id"),
            "is_read": row.get("is_read", False),
            "created_at": row.get("created_at"),
        }

    def create_notification(self, title: str, message: str, severity: str, complaint_id: str | None = None) -> dict:
        # `id` is a uuid with a database default, so it is deliberately not sent.
        payload = {
            "title": title,
            "message": message,
            "type": severity or "info",
            "complaint_id": _as_uuid(complaint_id),
            "is_read": False,
        }
        response = httpx.post(self.url, headers=self.headers, json=payload, timeout=10)
        response.raise_for_status()
        data = response.json()
        return self._to_api(data[0] if isinstance(data, list) else data)

    def list_notifications(self) -> list[dict]:
        response = httpx.get(self.url, headers=self.headers, params={"select": "*", "order": "created_at.desc"}, timeout=10)
        response.raise_for_status()
        return [self._to_api(row) for row in response.json()]


def get_notification_repository() -> NotificationRepository:
    if settings.storage_mode == "supabase":
        return SupabaseNotificationRepository()
    return NotificationRepository()


notifications_store: List[dict] = [
    {
        "id": "NTF-1750000000000",
        "title": "Complaint received",
        "message": "A new civic issue was submitted and routed for AI classification.",
        "severity": "info",
        "complaint_id": "CMP-1024",
        "created_at": datetime.now(timezone.utc).isoformat(),
    },
    {
        "id": "NTF-1750000000001",
        "title": "Worker assigned",
        "message": "The complaint has been assigned to a department worker for follow-up.",
        "severity": "success",
        "complaint_id": "CMP-1018",
        "created_at": datetime.now(timezone.utc).isoformat(),
    },
]


class NotificationCreateRequest(BaseModel):
    title: str
    message: str
    severity: str = "info"
    complaint_id: str | None = None


def add_notification(title: str, message: str, severity: str = "info", complaint_id: str | None = None) -> dict:
    repository = get_notification_repository()
    try:
        notification = repository.create_notification(title, message, severity, complaint_id)
    except (httpx.HTTPError, RuntimeError) as exc:
        if settings.app_env == "production":
            raise
        detail = exc.response.text[:300] if isinstance(exc, httpx.HTTPStatusError) else str(exc)
        logger.warning("Supabase notification insert failed, keeping it in memory only: %s", detail)
        notification = NotificationRepository().create_notification(title, message, severity, complaint_id)
    notifications_store.insert(0, notification)
    return notification


@router.get("/")
def list_notifications():
    if settings.storage_mode == "supabase":
        try:
            data = SupabaseNotificationRepository().list_notifications()
            if data:
                return data
        except (httpx.HTTPError, RuntimeError):
            if settings.app_env == "production":
                raise
        return notifications_store
    return notifications_store


@router.post("/")
def create_notification(payload: NotificationCreateRequest):
    return add_notification(payload.title, payload.message, payload.severity, payload.complaint_id)

