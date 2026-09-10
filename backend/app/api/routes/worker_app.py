"""The field worker app, and the dashboard side of reviewing what it submits.

A worker opens ``/worker`` on their phone, signs in with the same ``public.users``
credentials the dashboard uses, and sees only the complaints assigned to them. Marking a
job done is deliberately not a single button: the submission is refused unless it carries

  * a photo of the finished work, taken recently rather than pulled from the gallery, and
  * the phone's GPS position at that moment, accurate enough to mean something, and
    within :attr:`Settings.work_geofence_metres` of the complaint when the complaint has
    coordinates of its own.

That turns "the worker says it is fixed" into evidence an administrator can check. The
administrator then approves (complaint -> resolved, and the citizen who filed it on
Telegram is told) or rejects (complaint -> in_progress, worker sees why).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.routes.notifications import add_notification
from app.core.config import settings
from app.core.domain import InvalidStatusTransition
from app.core.security import CurrentUser, current_user, require_staff
from app.services.repository import get_complaint_repository
from app.services.work_submissions import (
    SubmissionsUnavailable,
    get_submission_store,
    haversine_metres,
)

logger = logging.getLogger("raipurone.worker_app")
router = APIRouter()

WORKER_PAGE = Path(__file__).resolve().parents[2] / "static" / "worker.html"

#: Statuses a worker still has something to do about.
OPEN_STATUSES = {"assigned", "in_progress", "under_review"}

MAX_PHOTO_BYTES = 8 * 1024 * 1024
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


# --- Worker lookup ----------------------------------------------------------
#
# repository.list_workers() deliberately drops user_id from its worker records, so there
# is no way to go from a signed-in user back to their worker row through it. This reads
# public.workers directly, the same way core.security reads public.users.

def _supabase_headers() -> dict[str, str]:
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def find_worker_for_user(user_id: str) -> dict[str, Any] | None:
    if not settings.supabase_url or not user_id:
        return None
    try:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/workers",
            headers=_supabase_headers(),
            params={
                "select": "*,users(username,role),departments(name)",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
            timeout=10.0,
        )
        response.raise_for_status()
        rows = response.json()
    except httpx.HTTPError as exc:
        logger.warning("Worker lookup failed for user %s: %s", user_id, exc)
        return None
    if not rows:
        return None
    row = rows[0]
    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "employee_code": row.get("employee_code"),
        "name": (row.get("users") or {}).get("username") or row.get("employee_code") or "Worker",
        "designation": row.get("designation") or "",
        "department": (row.get("departments") or {}).get("name") or "",
        "phone": row.get("phone") or "",
    }


def require_worker(user: Annotated[CurrentUser, Depends(current_user)]) -> dict[str, Any]:
    """The worker row behind the signed-in user, or 403."""
    if user.role not in {"worker", "admin", "manager"}:
        raise HTTPException(status_code=403, detail="This app is for field workers only")
    worker = find_worker_for_user(user.user_id)
    if not worker:
        raise HTTPException(
            status_code=403,
            detail="Your login is not linked to a worker record. Ask an administrator to set one up.",
        )
    worker["role"] = user.role
    return worker


CurrentWorker = Annotated[dict, Depends(require_worker)]


# --- The page ---------------------------------------------------------------

@router.get("", include_in_schema=False)
@router.get("/", include_in_schema=False)
def worker_page():
    if not WORKER_PAGE.exists():  # pragma: no cover - only if the file is deleted
        raise HTTPException(status_code=500, detail="Worker app page is missing")
    # no-cache means revalidate, not re-download: the ETag still answers 304 for an
    # unchanged page. Without it a browser is free to serve a stale copy from its
    # heuristic cache, and a worker ends up running a version of the app that was
    # replaced days ago while the page looks perfectly normal.
    return FileResponse(
        WORKER_PAGE,
        media_type="text/html",
        headers={"Cache-Control": "no-cache"},
    )


# --- Worker endpoints -------------------------------------------------------

@router.get("/me")
def read_worker_profile(worker: CurrentWorker):
    return {"success": True, "worker": worker, "geofence_metres": settings.work_geofence_metres}


@router.get("/tasks")
def list_my_tasks(worker: CurrentWorker):
    """Complaints assigned to this worker that are not finished yet."""
    complaints = get_complaint_repository().list_complaints()
    mine = [
        complaint
        for complaint in complaints
        if str(complaint.get("assigned_worker_id") or "") == str(worker["id"])
        and complaint.get("status") in OPEN_STATUSES
    ]

    rejected_notes: dict[str, str] = {}
    try:
        for submission in get_submission_store().list_for_worker(str(worker["id"]), limit=50):
            complaint_id = str(submission.get("complaint_id"))
            if submission.get("status") == "rejected" and complaint_id not in rejected_notes:
                rejected_notes[complaint_id] = submission.get("review_notes") or "Sent back for rework"
    except SubmissionsUnavailable as exc:
        # A worker can still see their tasks before the migration has been run.
        logger.warning("Could not load submission history: %s", exc)

    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    tasks = [
        {
            "id": complaint.get("id"),
            "title": complaint.get("title"),
            "description": complaint.get("description"),
            "category": complaint.get("category"),
            "priority": complaint.get("priority"),
            "status": complaint.get("status"),
            "location_text": complaint.get("location_text"),
            "location_lat": complaint.get("location_lat"),
            "location_lng": complaint.get("location_lng"),
            "has_coordinates": complaint.get("location_lat") is not None
            and complaint.get("location_lng") is not None,
            "submitted_at": complaint.get("submitted_at"),
            "rework_reason": rejected_notes.get(str(complaint.get("id"))),
        }
        for complaint in mine
    ]
    tasks.sort(key=lambda task: priority_order.get(task["priority"], 4))
    return {"success": True, "tasks": tasks, "count": len(tasks)}


def _owned_task(worker: dict, complaint_id: str) -> dict[str, Any]:
    complaint = get_complaint_repository().get_complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Task not found")
    if str(complaint.get("assigned_worker_id") or "") != str(worker["id"]):
        raise HTTPException(status_code=403, detail="This task is not assigned to you")
    return complaint


@router.post("/tasks/{complaint_id}/start")
def start_task(complaint_id: str, worker: CurrentWorker):
    complaint = _owned_task(worker, complaint_id)
    if complaint.get("status") == "in_progress":
        return {"success": True, "data": complaint}
    try:
        updated = get_complaint_repository().update_complaint(
            complaint_id, {"status": "in_progress"}, actor_user_id=worker["user_id"]
        )
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    from app.api.routes.complaints import notify_citizen_of_status

    notify_citizen_of_status(updated, "in_progress")
    return {"success": True, "data": updated}


@router.post("/tasks/{complaint_id}/submit")
async def submit_work(
    complaint_id: str,
    worker: CurrentWorker,
    lat: Annotated[float, Form(ge=-90, le=90)],
    lng: Annotated[float, Form(ge=-180, le=180)],
    photo: Annotated[UploadFile, File()],
    accuracy_m: Annotated[float | None, Form()] = None,
    photo_taken_at: Annotated[int | None, Form()] = None,
    notes: Annotated[str, Form(max_length=1000)] = "",
):
    """Mark a job done, with photo and GPS proof. Both are mandatory."""
    complaint = _owned_task(worker, complaint_id)
    if complaint.get("status") not in {"assigned", "in_progress"}:
        raise HTTPException(
            status_code=409,
            detail=f"This task is '{complaint.get('status')}' and cannot be submitted again.",
        )

    store = get_submission_store()
    try:
        if store.pending_for_complaint(complaint_id):
            raise HTTPException(status_code=409, detail="This task is already waiting for review.")
    except SubmissionsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # --- Location checks ---
    if accuracy_m is not None and accuracy_m > settings.work_max_gps_accuracy_metres:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Your GPS is only accurate to {accuracy_m:.0f}m. Step outside, wait for a "
                "better signal and try again."
            ),
        )

    distance_m: float | None = None
    location_verified = False
    if complaint.get("location_lat") is not None and complaint.get("location_lng") is not None:
        distance_m = haversine_metres(
            lat, lng, float(complaint["location_lat"]), float(complaint["location_lng"])
        )
        if distance_m > settings.work_geofence_metres:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"You are {distance_m:.0f}m from the complaint location. "
                    f"Submit from within {settings.work_geofence_metres:.0f}m of the site."
                ),
            )
        location_verified = True

    # --- Photo checks ---
    if photo_taken_at:
        taken = datetime.fromtimestamp(photo_taken_at / 1000, tz=timezone.utc)
        age = datetime.now(timezone.utc) - taken
        if age > timedelta(minutes=settings.work_photo_max_age_minutes):
            raise HTTPException(
                status_code=422,
                detail=(
                    f"That photo is {age.total_seconds() / 60:.0f} minutes old. "
                    "Take a fresh photo of the finished work."
                ),
            )

    content = await photo.read()
    if not content:
        raise HTTPException(status_code=422, detail="A photo of the finished work is required.")
    if len(content) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo is too large. Keep it under 8 MB.")
    content_type = (photo.content_type or "").lower().split(";")[0]
    if content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=422, detail="Upload a photo, not a file of another type.")

    repository = get_complaint_repository()
    if not hasattr(repository, "upload_complaint_image"):
        raise HTTPException(status_code=503, detail="Photo storage is not configured.")
    suffix = {"image/png": "png", "image/webp": "webp"}.get(content_type, "jpg")
    filename = f"work-{uuid.uuid4().hex}.{suffix}"
    try:
        repository.upload_complaint_image(complaint_id, content, filename, content_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not store the photo: {exc}") from exc

    try:
        submission = store.create(
            {
                "complaint_id": complaint_id,
                "worker_id": worker["id"],
                "worker_user_id": worker["user_id"],
                "worker_name": worker["name"],
                "photo_path": f"{complaint_id}/{filename}",
                "notes": notes.strip() or None,
                "lat": lat,
                "lng": lng,
                "accuracy_m": accuracy_m,
                "distance_m": distance_m,
                "location_verified": location_verified,
                "status": "pending",
            }
        )
    except SubmissionsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # 'assigned' cannot jump straight to 'under_review'; walk it through 'in_progress'.
    try:
        if complaint.get("status") == "assigned":
            repository.update_complaint(
                complaint_id, {"status": "in_progress"}, actor_user_id=worker["user_id"]
            )
        updated = repository.update_complaint(
            complaint_id, {"status": "under_review"}, actor_user_id=worker["user_id"]
        )
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    add_notification(
        "Work submitted for review",
        f"{worker['name']} submitted proof of work for {complaint.get('title') or complaint_id}.",
        "info",
        complaint_id,
    )
    from app.api.routes.complaints import notify_citizen_of_status

    notify_citizen_of_status(updated, "under_review")

    return {
        "success": True,
        "submission": submission,
        "complaint": updated,
        "distance_m": distance_m,
        "location_verified": location_verified,
    }


@router.get("/my-submissions")
def list_my_submissions(worker: CurrentWorker):
    try:
        return {"success": True, "data": get_submission_store().list_for_worker(str(worker["id"]))}
    except SubmissionsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# --- Keeping the review queue in step with the complaint --------------------

#: What a pending submission becomes when its complaint is moved from somewhere else.
#: ``under_review`` is absent on purpose - that is where a pending submission belongs.
_SETTLEMENT: dict[str, str] = {
    "resolved": "approved",
    "closed": "approved",
    "rejected": "rejected",
    "in_progress": "rejected",
    "assigned": "rejected",
    "submitted": "rejected",
}


def settle_submission_for(complaint_id: str, status: str, actor_user_id: str | None = None) -> None:
    """Resolve any pending submission when its complaint is moved outside the queue.

    Called only from the operator-facing status routes. The worker app makes its own
    transitions directly against the repository, so a worker submitting - which walks
    the complaint through ``in_progress`` on its way to ``under_review`` - never lands
    here and cannot reject its own fresh submission.

    Best-effort: a stale queue row must never make an operator's status update fail.
    """
    target = _SETTLEMENT.get(str(status).lower())
    if not target:
        return
    try:
        changed = get_submission_store().settle_for_complaint(
            complaint_id,
            target,
            reviewed_by=actor_user_id,
            review_notes=f"Settled automatically when the complaint was marked {status}.",
        )
        if changed:
            logger.info(
                "Settled %d pending submission(s) for %s as %s", len(changed), complaint_id, target
            )
    except SubmissionsUnavailable as exc:
        logger.warning("Could not settle submissions for %s: %s", complaint_id, exc)


# --- Dashboard review endpoints ---------------------------------------------

class ReviewRequest(BaseModel):
    review_notes: str = Field(default="", max_length=1000)


def _signed_photo_url(storage_path: str) -> str | None:
    repository = get_complaint_repository()
    if not hasattr(repository, "create_signed_image_url"):
        return None
    try:
        return repository.create_signed_image_url(storage_path)
    except Exception as exc:  # pragma: no cover - a missing photo must not hide the row
        logger.warning("Could not sign work photo %s: %s", storage_path, exc)
        return None


def _decorate(submission: dict[str, Any]) -> dict[str, Any]:
    complaint = get_complaint_repository().get_complaint(str(submission.get("complaint_id"))) or {}
    return {
        **submission,
        "photo_url": _signed_photo_url(str(submission.get("photo_path"))),
        "complaint_title": complaint.get("title"),
        "complaint_status": complaint.get("status"),
        "complaint_category": complaint.get("category"),
        "citizen_name": complaint.get("citizen_name"),
        "has_telegram": bool(complaint.get("telegram_chat_id")),
    }


@router.get("/submissions/pending")
def list_pending_submissions(user: Annotated[CurrentUser, Depends(require_staff)]):
    try:
        pending = get_submission_store().list_pending()
    except SubmissionsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"success": True, "data": [_decorate(item) for item in pending]}


def _review(submission_id: str, approve: bool, notes: str, user: CurrentUser) -> dict[str, Any]:
    store = get_submission_store()
    try:
        submission = store.get(submission_id)
    except SubmissionsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.get("status") != "pending":
        raise HTTPException(
            status_code=409, detail=f"This submission was already {submission.get('status')}."
        )

    complaint_id = str(submission.get("complaint_id"))
    target_status = "resolved" if approve else "in_progress"
    updates: dict[str, Any] = {"status": target_status}
    if approve and notes:
        updates["resolution_summary"] = notes
    try:
        updated = get_complaint_repository().update_complaint(
            complaint_id, updates, actor_user_id=user.user_id
        )
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint not found")

    reviewed = store.review(submission_id, "approved" if approve else "rejected", notes, user.user_id)

    add_notification(
        "Work approved" if approve else "Work sent back",
        f"{updated.get('title') or complaint_id} was "
        + ("approved and marked resolved." if approve else "returned to the worker for rework."),
        "success" if approve else "warning",
        complaint_id,
    )

    # This is the message the citizen has been waiting for since they filed the complaint.
    from app.api.routes.complaints import notify_citizen_of_status

    notify_citizen_of_status(updated, target_status)

    return {"success": True, "data": reviewed, "complaint": updated}


@router.post("/submissions/{submission_id}/approve")
def approve_submission(
    submission_id: str,
    payload: ReviewRequest,
    user: Annotated[CurrentUser, Depends(require_staff)],
):
    return _review(submission_id, True, payload.review_notes.strip(), user)


@router.post("/submissions/{submission_id}/reject")
def reject_submission(
    submission_id: str,
    payload: ReviewRequest,
    user: Annotated[CurrentUser, Depends(require_staff)],
):
    notes = payload.review_notes.strip()
    if not notes:
        raise HTTPException(status_code=422, detail="Tell the worker why the work was rejected.")
    return _review(submission_id, False, notes, user)
