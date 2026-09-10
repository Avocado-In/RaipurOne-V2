"""Analytics for the dashboard homepage.

The frontend has always called ``/analytics`` but no such endpoint existed, so the chart
fell back to randomly generated numbers on every load. These figures are computed from
real complaint rows.
"""
from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, require_staff
from app.services.repository import get_complaint_repository

logger = logging.getLogger("raipurone.analytics")
router = APIRouter()

_RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90}

_OPEN_STATUSES = {"submitted", "assigned", "under_review"}
_DONE_STATUSES = {"resolved", "closed"}

# Stable colours so a department keeps the same slice colour between loads.
_PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#64748b"]


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


@router.get("")
def get_analytics(
    user: Annotated[CurrentUser, Depends(require_staff)],
    # Aliased so the query string stays `?range=` without shadowing the builtin.
    time_range: str = Query("7d", alias="range"),
):
    days = _RANGE_DAYS.get(time_range, 7)
    complaints = get_complaint_repository().list_complaints()
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=days)

    statuses = Counter(str(c.get("status") or "submitted") for c in complaints)
    total = len(complaints)
    completed = sum(statuses[s] for s in _DONE_STATUSES if s in statuses)
    pending = sum(statuses[s] for s in _OPEN_STATUSES if s in statuses)
    in_progress = statuses.get("in_progress", 0)

    # Daily created/completed counts across the requested window.
    trend: list[dict[str, Any]] = []
    for offset in range(days + 1):
        day = (window_start + timedelta(days=offset)).date()
        created = sum(
            1
            for c in complaints
            if (ts := _parse_timestamp(c.get("submitted_at") or c.get("created_at"))) and ts.date() == day
        )
        done = sum(
            1 for c in complaints if (ts := _parse_timestamp(c.get("resolved_at"))) and ts.date() == day
        )
        trend.append(
            {
                "date": day.strftime("%b %d"),
                "created": created,
                "completed": done,
                "pending": max(created - done, 0),
            }
        )

    by_category = Counter(str(c.get("category") or "Others") for c in complaints)
    department_distribution = [
        {"name": name, "value": count, "color": _PALETTE[index % len(_PALETTE)]}
        for index, (name, count) in enumerate(by_category.most_common(8))
    ]

    status_distribution = [
        {"name": "Completed", "value": completed, "color": "#10b981"},
        {"name": "Pending", "value": pending, "color": "#f59e0b"},
        {"name": "In Progress", "value": in_progress, "color": "#3b82f6"},
    ]

    workers = get_complaint_repository().list_workers()
    worker_performance = [
        {
            "name": w.get("name") or "Worker",
            "completed": w.get("completed_tasks") or 0,
            "inProgress": w.get("active_tasks") or 0,
            "rating": w.get("rating") or 0,
        }
        for w in workers
    ]

    completion_rate = round((completed / total) * 100, 1) if total else 0.0
    return {
        "summary": {
            "totalTickets": total,
            "completedTickets": completed,
            "pendingTickets": pending,
            "inProgressTickets": in_progress,
            "activeWorkers": sum(1 for w in workers if w.get("is_active", True)),
            "responseTime": _average_resolution_time(complaints),
            "completionRate": completion_rate,
            "customerSatisfaction": 0,
        },
        "ticketTrend": trend,
        "workerPerformance": worker_performance,
        "departmentDistribution": department_distribution,
        "statusDistribution": status_distribution,
    }


def _average_resolution_time(complaints: list[dict[str, Any]]) -> str:
    """Mean time from submission to resolution, or "-" when nothing is resolved yet."""
    spans: list[float] = []
    for complaint in complaints:
        start = _parse_timestamp(complaint.get("submitted_at") or complaint.get("created_at"))
        end = _parse_timestamp(complaint.get("resolved_at"))
        if start and end and end >= start:
            spans.append((end - start).total_seconds() / 3600)
    if not spans:
        return "—"
    average = sum(spans) / len(spans)
    return f"{average:.1f} hrs" if average < 48 else f"{average / 24:.1f} days"
