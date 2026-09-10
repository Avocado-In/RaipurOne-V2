"""Storage for worker proof-of-work submissions.

The worker app writes one row here per completed job; the dashboard reads the pending
ones and approves or rejects them. Kept out of ``repository.py`` because that module owns
complaints and workers, and this table is only ever touched by the worker flow.

Talks to PostgREST directly with the service-role key, the same way
``core.security`` reaches ``public.users``. Rows carry a worker's GPS position, so the
table is never exposed to the anon key (see the migration).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("raipurone.work_submissions")

TABLE = "work_submissions"


class SubmissionsUnavailable(RuntimeError):
    """The work_submissions table is missing or unreachable."""


def haversine_metres(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres between two WGS84 points."""
    earth_radius_m = 6371008.8
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    return 2 * earth_radius_m * asin(sqrt(a))


class WorkSubmissionStore:
    def __init__(self) -> None:
        self.url = settings.supabase_url.rstrip("/")
        self.key = settings.supabase_service_role_key or settings.supabase_anon_key

    @property
    def configured(self) -> bool:
        return bool(self.url and self.key)

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def _request(
        self,
        method: str,
        params: dict[str, str] | None = None,
        payload: Any = None,
        path: str = "",
    ) -> Any:
        if not self.configured:
            raise SubmissionsUnavailable("Supabase is not configured")
        try:
            response = httpx.request(
                method,
                f"{self.url}/rest/v1/{TABLE}{path}",
                headers=self._headers(),
                params=params,
                json=payload,
                timeout=15.0,
            )
        except httpx.HTTPError as exc:
            raise SubmissionsUnavailable(f"work_submissions unreachable: {exc}") from exc
        if response.status_code == 404 or "PGRST205" in response.text:
            raise SubmissionsUnavailable(
                "The work_submissions table does not exist. "
                "Run supabase/work_submissions_migration.sql against the project database."
            )
        if response.is_error:
            raise SubmissionsUnavailable(
                f"work_submissions {response.status_code}: {response.text[:300]}"
            )
        return response.json()

    # --- Writes -------------------------------------------------------------

    def create(self, submission: dict[str, Any]) -> dict[str, Any]:
        data = self._request("POST", payload=submission)
        return data[0] if isinstance(data, list) else data

    def review(
        self,
        submission_id: str,
        status: str,
        review_notes: str | None,
        reviewed_by: str | None,
    ) -> dict[str, Any] | None:
        payload = {
            "status": status,
            "review_notes": review_notes or None,
            "reviewed_by": reviewed_by or None,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
        data = self._request("PATCH", params={"id": f"eq.{submission_id}"}, payload=payload)
        rows = data if isinstance(data, list) else [data]
        return rows[0] if rows else None

    # --- Reads --------------------------------------------------------------

    def get(self, submission_id: str) -> dict[str, Any] | None:
        rows = self._request("GET", params={"select": "*", "id": f"eq.{submission_id}", "limit": "1"})
        return rows[0] if rows else None

    def list_pending(self) -> list[dict[str, Any]]:
        return self._request(
            "GET",
            params={"select": "*", "status": "eq.pending", "order": "submitted_at.desc"},
        )

    def list_for_worker(self, worker_id: str, limit: int = 20) -> list[dict[str, Any]]:
        return self._request(
            "GET",
            params={
                "select": "*",
                "worker_id": f"eq.{worker_id}",
                "order": "submitted_at.desc",
                "limit": str(limit),
            },
        )

    def pending_for_complaint(self, complaint_id: str) -> dict[str, Any] | None:
        rows = self._request(
            "GET",
            params={
                "select": "*",
                "complaint_id": f"eq.{complaint_id}",
                "status": "eq.pending",
                "limit": "1",
            },
        )
        return rows[0] if rows else None


_store: WorkSubmissionStore | None = None


def get_submission_store() -> WorkSubmissionStore:
    global _store
    if _store is None:
        _store = WorkSubmissionStore()
    return _store
