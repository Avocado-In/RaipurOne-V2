"""Structured audit trail for complaint changes.

The ``audit_logs`` and ``assignment_history`` tables have existed in the schema since
Phase 3 but nothing ever wrote to them, so there was no record of who changed what. Every
status change and assignment now lands here with before/after values.

Column names below follow the *live* database, which differs from ``supabase/schema.sql``
(``entity_name``/``old_data``/``new_data`` rather than ``entity_type``/``before_data``/
``after_data``; assignment history keyed on ``from_worker_id``/``to_worker_id``).

Audit writes must never break the operation being audited: a failure is logged and
swallowed, because losing an audit row is bad but refusing a citizen's complaint because
the audit insert failed is worse.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("raipurone.audit")


def _as_uuid(value: Any) -> str | None:
    """Audit id columns are uuid; legacy ids such as ``CMP-1024`` are not."""
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        return None


def _headers() -> dict[str, str]:
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def _enabled() -> bool:
    return bool(
        settings.supabase_url
        and (settings.supabase_service_role_key or settings.supabase_anon_key)
    )


def _post(table: str, payload: dict[str, Any]) -> None:
    if not _enabled():
        logger.debug("Audit skipped (Supabase not configured): %s", table)
        return
    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/{table}"
    try:
        response = httpx.post(url, headers=_headers(), json=payload, timeout=10)
        if response.is_error:
            logger.warning(
                "Audit insert into %s failed: %s %s", table, response.status_code, response.text[:200]
            )
    except httpx.HTTPError as exc:
        logger.warning("Audit insert into %s failed: %s", table, exc)


def record_change(
    entity_name: str,
    entity_id: str,
    action: str,
    actor_user_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Write one immutable audit row describing a change."""
    target = _as_uuid(entity_id)
    if target is None:
        # Keep the trail rather than dropping it: stash the non-uuid id in metadata.
        metadata = {**(metadata or {}), "entity_ref": str(entity_id)}
    _post(
        "audit_logs",
        {
            "actor_user_id": _as_uuid(actor_user_id),
            "entity_name": entity_name,
            "entity_id": target,
            "action": action,
            "old_data": before or {},
            "new_data": after or {},
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )


def record_assignment(
    complaint_id: str,
    to_worker_id: str | None = None,
    from_worker_id: str | None = None,
    assigned_by: str | None = None,
    reason: str | None = None,
    note: str | None = None,
) -> None:
    """Append to the per-complaint assignment history."""
    target = _as_uuid(complaint_id)
    if target is None:
        logger.debug("Assignment history skipped for non-uuid complaint id %s", complaint_id)
        return
    _post(
        "assignment_history",
        {
            "complaint_id": target,
            "from_worker_id": _as_uuid(from_worker_id),
            "to_worker_id": _as_uuid(to_worker_id),
            "assigned_by": _as_uuid(assigned_by),
            "assignment_reason": reason,
            "assignment_note": note,
            "changed_at": datetime.now(timezone.utc).isoformat(),
        },
    )
