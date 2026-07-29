import os
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import settings


def normalize_complaint_for_storage(complaint: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(complaint.get("id") or uuid.uuid4()),
        "citizen_user_id": complaint.get("citizen_user_id"),
        "citizen_name": complaint.get("citizen_name") or "Citizen",
        "title": complaint.get("title") or "",
        "description": complaint.get("description") or "",
        "category": complaint.get("category") or "general",
        "department_id": complaint.get("department_id"),
        "priority": str(complaint.get("priority") or "medium").lower(),
        "status": str(complaint.get("status") or "submitted").lower(),
        "assigned_worker_id": complaint.get("assigned_worker_id"),
        "recommended_worker_id": complaint.get("recommended_worker_id"),
        "ai_analysis": complaint.get("ai_analysis") or {},
        "recommended_worker_payload": complaint.get("recommended_worker_payload") or {},
        "location_text": complaint.get("location_text"),
        "location_lat": complaint.get("location_lat"),
        "location_lng": complaint.get("location_lng"),
        "submitted_by_ip": complaint.get("submitted_by_ip"),
        "resolution_summary": complaint.get("resolution_summary"),
        "submitted_at": complaint.get("submitted_at") or now,
        "updated_at": complaint.get("updated_at") or complaint.get("submitted_at") or now,
        "resolved_at": complaint.get("resolved_at"),
        "closed_at": complaint.get("closed_at"),
        "source": complaint.get("source") or "web",
        "telegram_chat_id": complaint.get("telegram_chat_id"),
        "telegram_message_id": complaint.get("telegram_message_id"),
    }


def normalize_complaint_record(row: dict[str, Any], fallback_id: str | None = None) -> dict[str, Any]:
    department = row.get("department")
    if department is None and row.get("category"):
        department = str(row.get("category", "")).title()

    return {
        "id": str(row.get("id") or fallback_id or str(uuid.uuid4())),
        "citizen_user_id": row.get("citizen_user_id"),
        "citizen_name": row.get("citizen_name") or "Citizen",
        "title": row.get("title") or "",
        "description": row.get("description") or "",
        "category": row.get("category") or "general",
        "department": department,
        "department_id": row.get("department_id"),
        "priority": row.get("priority") or "medium",
        "status": row.get("status") or "submitted",
        "assigned_worker_id": row.get("assigned_worker_id"),
        "assigned_worker": row.get("assigned_worker"),
        "recommended_worker_id": row.get("recommended_worker_id"),
        "recommended_worker_payload": row.get("recommended_worker_payload") or {},
        "ai_analysis": row.get("ai_analysis") or {},
        "location_text": row.get("location_text"),
        "location_lat": row.get("location_lat"),
        "location_lng": row.get("location_lng"),
        "submitted_by_ip": row.get("submitted_by_ip"),
        "resolution_summary": row.get("resolution_summary"),
        "submitted_at": row.get("submitted_at"),
        "created_at": row.get("created_at") or row.get("submitted_at"),
        "updated_at": row.get("updated_at") or row.get("submitted_at"),
        "resolved_at": row.get("resolved_at"),
        "closed_at": row.get("closed_at"),
        "source": row.get("source") or "web",
        "telegram_chat_id": row.get("telegram_chat_id"),
        "telegram_message_id": row.get("telegram_message_id"),
    }


class InMemoryComplaintRepository:
    def list_workers(self) -> list[dict[str, Any]]:
        return getattr(self, "_workers", [])

    def create_worker(self, worker: dict[str, Any]) -> dict[str, Any]:
        if not hasattr(self, "_workers"):
            self._workers = []
        self._workers.append(worker)
        return worker

    def get_worker(self, worker_id: str) -> dict[str, Any] | None:
        return next((worker for worker in self.list_workers() if worker.get("worker_id") == worker_id or worker.get("id") == worker_id), None)
    def __init__(self) -> None:
        self._store: list[dict[str, Any]] = [
            {
                "id": "CMP-1024",
                "citizen_user_id": None,
                "citizen_name": "Asha Verma",
                "title": "Streetlight outage near Sector 12",
                "description": "Multiple streetlights in the sector are not functioning after dusk.",
                "category": "lighting",
                "department": "Public Works",
                "department_id": None,
                "priority": "high",
                "status": "in_progress",
                "assigned_worker_id": None,
                "assigned_worker": "Rajesh Kumar",
                "recommended_worker_id": None,
                "recommended_worker_payload": {"recommended_worker": "worker-24", "department": "Public Works", "confidence": 0.93},
                "ai_analysis": {"category": "infrastructure", "confidence": 0.91, "priority": "high"},
                "location_text": None,
                "location_lat": None,
                "location_lng": None,
                "submitted_by_ip": None,
                "resolution_summary": None,
                "submitted_at": "2025-07-20T09:15:00Z",
                "created_at": "2025-07-20T09:15:00Z",
                "updated_at": "2025-07-20T09:15:00Z",
                "resolved_at": None,
                "closed_at": None,
            },
            {
                "id": "CMP-1018",
                "citizen_user_id": None,
                "citizen_name": "Vikram Rao",
                "title": "Garbage accumulation at market square",
                "description": "Overflowing bins and blocked drains near the market entrance.",
                "category": "sanitation",
                "department": "Sanitation",
                "department_id": None,
                "priority": "medium",
                "status": "assigned",
                "assigned_worker_id": None,
                "assigned_worker": "Priya Sharma",
                "recommended_worker_id": None,
                "recommended_worker_payload": {"recommended_worker": "worker-17", "department": "Sanitation", "confidence": 0.84},
                "ai_analysis": {"category": "general", "confidence": 0.74, "priority": "medium"},
                "location_text": None,
                "location_lat": None,
                "location_lng": None,
                "submitted_by_ip": None,
                "resolution_summary": None,
                "submitted_at": "2025-07-20T08:10:00Z",
                "created_at": "2025-07-20T08:10:00Z",
                "updated_at": "2025-07-20T08:10:00Z",
                "resolved_at": None,
                "closed_at": None,
            },
            {
                "id": "CMP-1007",
                "citizen_user_id": None,
                "citizen_name": "Nisha Joshi",
                "title": "Water leakage near the community tank",
                "description": "Water leakage is causing pooling and traffic disruption.",
                "category": "water",
                "department": "Water Supply",
                "department_id": None,
                "priority": "high",
                "status": "resolved",
                "assigned_worker_id": None,
                "assigned_worker": "Amit Singh",
                "recommended_worker_id": None,
                "recommended_worker_payload": {"recommended_worker": "worker-11", "department": "Water Supply", "confidence": 0.93},
                "ai_analysis": {"category": "infrastructure", "confidence": 0.91, "priority": "high"},
                "location_text": None,
                "location_lat": None,
                "location_lng": None,
                "submitted_by_ip": None,
                "resolution_summary": None,
                "submitted_at": "2025-07-19T16:45:00Z",
                "created_at": "2025-07-19T16:45:00Z",
                "updated_at": "2025-07-19T16:45:00Z",
                "resolved_at": "2025-07-19T16:45:00Z",
                "closed_at": None,
            },
        ]


    def verify_telegram_schema(self) -> None:
        self._request("GET", "/complaints", params={"select": "source,telegram_chat_id,telegram_message_id", "limit": "1"})
    def list_complaints(self) -> list[dict[str, Any]]:
        return list(self._store)

    def get_complaint(self, complaint_id: str) -> dict[str, Any] | None:
        for complaint in self._store:
            if complaint["id"] == complaint_id:
                return complaint
        return None

    def create_complaint(self, complaint: dict[str, Any]) -> dict[str, Any]:
        self._store.insert(0, complaint)
        return complaint

    def update_complaint(self, complaint_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        complaint = self.get_complaint(complaint_id)
        if complaint is None:
            return None
        complaint.update(updates)
        return complaint


class SupabaseComplaintRepository(InMemoryComplaintRepository):
    def __init__(self, strict: bool = False) -> None:
        super().__init__()
        self.strict = strict
        self.url = settings.supabase_url.rstrip("/")
        service_key = settings.supabase_service_role_key
        if strict and not service_key:
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required for strict persistence")
        self.key = service_key or settings.supabase_anon_key
        if not self.url or not self.key:
            raise RuntimeError("SUPABASE_URL and Supabase key are required")
        self.base_url = f"{self.url}/rest/v1"
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self._fallback_store = InMemoryComplaintRepository()

    @staticmethod
    def _worker_record(row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row.get("id"),
            "worker_id": row.get("worker_code") or row.get("id"),
            "name": row.get("full_name") or row.get("name") or "Worker",
            "phone": row.get("phone") or row.get("phone_number") or "",
            "phone_number": row.get("phone") or row.get("phone_number") or "",
            "email": row.get("email") or "",
            "departments": row.get("departments") or [],
            "status": row.get("availability") or row.get("status") or "available",
            "is_active": (row.get("availability") or "available") != "offline",
            "active_tasks": row.get("workload") or 0,
            "completed_tasks": row.get("completed_tasks") or 0,
            "rating": row.get("rating") or 0,
            "work_type": ", ".join(row.get("departments") or []) or "General",
        }

    def list_workers(self) -> list[dict[str, Any]]:
        try:
            data = self._request("GET", "/workers", params={"select": "*"})
            return [self._worker_record(item) for item in data]
        except (httpx.HTTPError, ValueError, RuntimeError):
            if self.strict or settings.app_env == "production":
                raise
            return self._fallback_store.list_workers()

    def create_worker(self, worker: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "worker_code": worker["worker_id"],
            "full_name": worker["name"],
            "phone": worker.get("phone") or "",
            "email": worker.get("email") or "",
            "departments": worker.get("departments") or [],
            "availability": "available",
            "workload": 0,
        }
        try:
            data = self._request("POST", "/workers", payload=payload)
            return self._worker_record(data[0] if isinstance(data, list) else data)
        except RuntimeError as exc:
            # Older deployed schemas may not have worker_code/phone/email/departments.
            if "PGRST204" not in str(exc) and "column" not in str(exc).lower():
                if self.strict or settings.app_env == "production":
                    raise
            else:
                minimal_payload = {
                    "full_name": worker["name"],
                    "availability": "available",
                    "workload": 0,
                }
                data = self._request("POST", "/workers", payload=minimal_payload)
                row = data[0] if isinstance(data, list) else data
                return {**self._worker_record(row), "worker_id": row.get("id")}
            return self._fallback_store.create_worker({**worker, "status": "available", "active_tasks": 0, "completed_tasks": 0, "rating": 0})
        except (httpx.HTTPError, ValueError):
            if self.strict or settings.app_env == "production":
                raise
            return self._fallback_store.create_worker({**worker, "status": "available", "active_tasks": 0, "completed_tasks": 0, "rating": 0})

    def get_worker(self, worker_id: str) -> dict[str, Any] | None:
        workers = self.list_workers()
        return next((worker for worker in workers if worker.get("worker_id") == worker_id or worker.get("id") == worker_id), None)

    def _request(self, method: str, path: str, params: dict[str, str] | None = None, payload: dict[str, Any] | None = None) -> Any:
        response = httpx.request(
            method,
            f"{self.base_url}{path}",
            headers=self.headers,
            params=params,
            json=payload,
            timeout=10.0,
        )
        if response.is_error:
            raise RuntimeError(f"Supabase REST {response.status_code}: {response.text[:500]}")
        response.raise_for_status()
        return response.json()

    def ensure_complaint_image_bucket(self) -> None:
        response = httpx.post(
            f"{self.url}/storage/v1/bucket",
            headers=self.headers,
            json={"id": "complaint-images", "name": "complaint-images", "public": False},
            timeout=10.0,
        )
        if response.is_error and response.status_code not in {400, 409}:
            raise RuntimeError(f"Supabase Storage bucket setup {response.status_code}: {response.text[:500]}")

    def upload_complaint_image(self, complaint_id: str, content: bytes, filename: str, content_type: str = "image/jpeg") -> dict[str, Any]:
        storage_path = f"{complaint_id}/{filename}"
        response = httpx.put(
            f"{self.url}/storage/v1/object/complaint-images/{storage_path}",
            headers={**self.headers, "Content-Type": content_type, "x-upsert": "false"},
            content=content,
            timeout=20.0,
        )
        if response.is_error and "Bucket not found" in response.text:
            self.ensure_complaint_image_bucket()
            response = httpx.put(
                f"{self.url}/storage/v1/object/complaint-images/{storage_path}",
                headers={**self.headers, "Content-Type": content_type, "x-upsert": "false"},
                content=content,
                timeout=20.0,
            )
        if response.is_error:
            raise RuntimeError(f"Supabase Storage {response.status_code}: {response.text[:500]}")
        metadata = {
            "complaint_id": complaint_id,
            "storage_path": storage_path,
        }
        try:
            data = self._request("POST", "/complaint_images", payload=metadata)
        except RuntimeError as exc:
            if "content_type" not in str(exc):
                raise
            data = self._request("POST", "/complaint_images", payload={
                "complaint_id": complaint_id,
                "storage_path": storage_path,
            })
        return data[0] if isinstance(data, list) else data

    def list_complaint_images(self, complaint_id: str) -> list[dict[str, Any]]:
        data = self._request("GET", "/complaint_images", params={"select": "*", "complaint_id": f"eq.{complaint_id}"})
        return data if isinstance(data, list) else []

    def create_signed_image_url(self, storage_path: str, expires_in: int = 3600) -> str:
        response = httpx.post(
            f"{self.url}/storage/v1/object/sign/complaint-images/{storage_path}",
            headers=self.headers,
            json={"expiresIn": expires_in},
            timeout=10.0,
        )
        if response.is_error:
            raise RuntimeError(f"Supabase Storage {response.status_code}: {response.text[:500]}")
        body = response.json()
        signed = body.get("signedURL") or body.get("signedUrl")
        if not signed:
            raise RuntimeError("Supabase Storage did not return a signed image URL")
        return signed if signed.startswith("http") else f"{self.url}/storage/v1{signed}"

    def list_complaints(self) -> list[dict[str, Any]]:
        try:
            data = self._request("GET", "/complaints", params={"select": "*"})
            return [normalize_complaint_record(item) for item in data]
        except (httpx.HTTPError, ValueError, RuntimeError):
            if self.strict or settings.app_env == "production":
                raise
            return self._fallback_store.list_complaints()

    def get_complaint(self, complaint_id: str) -> dict[str, Any] | None:
        try:
            data = self._request("GET", "/complaints", params={"select": "*", "id": f"eq.{complaint_id}"})
            if not data:
                return None
            return normalize_complaint_record(data[0], fallback_id=complaint_id)
        except (httpx.HTTPError, ValueError, RuntimeError):
            if self.strict or settings.app_env == "production":
                raise
            return self._fallback_store.get_complaint(complaint_id)

    def create_complaint(self, complaint: dict[str, Any]) -> dict[str, Any]:
        stored_payload = normalize_complaint_for_storage(complaint)
        public_complaint = dict(complaint)
        public_complaint.update(
            {
                "priority": stored_payload["priority"],
                "status": stored_payload["status"],
                "submitted_at": stored_payload["submitted_at"],
                "created_at": complaint.get("created_at") or stored_payload["submitted_at"],
                "updated_at": stored_payload["updated_at"],
                "ai_analysis": stored_payload["ai_analysis"],
                "recommended_worker_payload": stored_payload["recommended_worker_payload"],
            }
        )
        try:
            data = self._request("POST", "/complaints", payload=stored_payload)
            row = data[0] if isinstance(data, list) else data
            return normalize_complaint_record(row, fallback_id=public_complaint.get("id"))
        except (httpx.HTTPError, ValueError, RuntimeError):
            if self.strict or settings.app_env == "production":
                raise
            self._fallback_store.create_complaint(public_complaint)
            return public_complaint

    def update_complaint(self, complaint_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        payload_updates: dict[str, Any] = {}
        if "status" in updates:
            payload_updates["status"] = str(updates["status"]).lower()
        if "priority" in updates:
            payload_updates["priority"] = str(updates["priority"]).lower()
        if "department" in updates:
            payload_updates["department"] = updates["department"]

        try:
            data = self._request("PATCH", "/complaints", params={"id": f"eq.{complaint_id}"}, payload=payload_updates)
            row = data[0] if isinstance(data, list) else data
            updated = normalize_complaint_record(row, fallback_id=complaint_id)
            if "department" in updates:
                updated["department"] = updates["department"]
            return updated
        except (httpx.HTTPError, ValueError, RuntimeError):
            if self.strict or settings.app_env == "production":
                raise
            existing = self._fallback_store.get_complaint(complaint_id)
            if existing is None:
                return None
            existing.update(updates)
            return existing


_repository: InMemoryComplaintRepository | None = None


def get_complaint_repository() -> InMemoryComplaintRepository:
    global _repository
    if _repository is None:
        try:
            _repository = SupabaseComplaintRepository()
        except RuntimeError:
            if settings.app_env == "production":
                raise
            _repository = InMemoryComplaintRepository()
    return _repository

















