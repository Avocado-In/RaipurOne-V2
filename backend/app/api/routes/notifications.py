import os
from datetime import datetime, timezone
from typing import Any, List

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()


class NotificationRepository:
    def create_notification(self, title: str, message: str, severity: str, complaint_id: str | None = None) -> dict:
        return {"id": f"NTF-{int(datetime.now(timezone.utc).timestamp() * 1000)}", "title": title, "message": message, "severity": severity, "complaint_id": complaint_id, "created_at": datetime.now(timezone.utc).isoformat()}


class SupabaseNotificationRepository(NotificationRepository):
    def __init__(self) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("Supabase notification configuration is missing")
        self.url = settings.supabase_url.rstrip("/") + "/rest/v1/notifications"
        self.headers = {"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}", "Content-Type": "application/json", "Prefer": "return=representation"}

    def create_notification(self, title: str, message: str, severity: str, complaint_id: str | None = None) -> dict:
        payload = {"id": f"NTF-{int(datetime.now(timezone.utc).timestamp() * 1000)}", "title": title, "message": message, "severity": severity, "complaint_id": complaint_id}
        response = httpx.post(self.url, headers=self.headers, json=payload, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data[0] if isinstance(data, list) else data

    def list_notifications(self) -> list[dict]:
        response = httpx.get(self.url, headers=self.headers, params={"select": "*", "order": "created_at.desc"}, timeout=10)
        response.raise_for_status()
        return response.json()


def get_notification_repository() -> NotificationRepository:
    if settings.storage_mode == "supabase":
        return SupabaseNotificationRepository()
    return NotificationRepository()


notifications_store: List[dict] = []


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
        notification = NotificationRepository().create_notification(title, message, severity, complaint_id)
    notifications_store.insert(0, notification)
    return notification


@router.get("/")
def list_notifications():
    if settings.storage_mode == "supabase":
        try:
            return SupabaseNotificationRepository().list_notifications()
        except (httpx.HTTPError, RuntimeError):
            if settings.app_env == "production":
                raise
    return notifications_store


@router.post("/")
def create_notification(payload: NotificationCreateRequest):
    return add_notification(payload.title, payload.message, payload.severity, payload.complaint_id)

