import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from app.api.routes.ai import classify_complaint_text, recommend_worker_for_department
from app.api.routes.notifications import add_notification
from app.core.domain import (
    CategoryLiteral,
    InvalidStatusTransition,
    PriorityLiteral,
    StatusLiteral,
    canonicalize_category,
)
from app.core.security import CurrentUser, require_staff, optional_user
from app.services.rate_limit import enforce_rate_limit
from app.services.repository import get_complaint_repository

logger = logging.getLogger("raipurone.complaints")
router = APIRouter()

repository = get_complaint_repository()

# Bounds chosen to accept any genuine civic complaint while refusing payloads that only a
# script would send. Previously these were unbounded `str`.
TITLE_MAX = 200
DESCRIPTION_MAX = 5000


class ComplaintCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=TITLE_MAX)
    description: str = Field(min_length=5, max_length=DESCRIPTION_MAX)
    category: CategoryLiteral | None = None


class ComplaintStatusUpdate(BaseModel):
    status: StatusLiteral
    resolution_summary: str | None = Field(default=None, max_length=DESCRIPTION_MAX)


class ComplaintAssignmentUpdate(BaseModel):
    department: str = Field(min_length=1, max_length=120)
    priority: PriorityLiteral
    status: StatusLiteral
    assigned_worker_id: str | None = None


@router.get("/")
def list_complaints(user: Annotated[CurrentUser, Depends(optional_user)]):
    """Staff see every complaint; a citizen sees only their own."""
    complaints = repository.list_complaints()
    if user and user.is_staff:
        return complaints
    if user:
        return [c for c in complaints if c.get("citizen_user_id") == user.user_id]
    return complaints


def _build_complaint_payload(
    title: str,
    description: str,
    category: str | None,
    citizen_user_id: str | None = None,
    citizen_name: str | None = None,
    client_ip: str | None = None,
) -> dict:
    analysis = classify_complaint_text(f"{title} {description}")
    # The classifier wins over a caller-supplied category unless it abstains.
    inferred_category = canonicalize_category(analysis.get("category") or category)
    recommendation = recommend_worker_for_department(inferred_category, analysis["priority"])
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid.uuid4()),
        "citizen_user_id": citizen_user_id,
        "citizen_name": citizen_name or "Citizen",
        "title": title,
        "description": description,
        "category": inferred_category,
        "department_id": None,
        "department": recommendation.get("department") or inferred_category,
        "priority": analysis["priority"],
        "status": "submitted",
        "assigned_worker_id": None,
        "assigned_worker": recommendation.get("recommended_worker"),
        "recommended_worker_id": recommendation.get("recommended_worker_id"),
        "recommended_worker_payload": recommendation,
        "ai_analysis": analysis,
        "location_text": None,
        "location_lat": None,
        "location_lng": None,
        "submitted_by_ip": client_ip,
        "resolution_summary": None,
        "submitted_at": now,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
        "closed_at": None,
    }


def _create(request: Request, title: str, description: str, category: str | None, user: CurrentUser | None) -> dict:
    client_ip = request.client.host if request.client else None
    enforce_rate_limit(f"complaint:{user.user_id if user else client_ip}")
    complaint = _build_complaint_payload(
        title,
        description,
        category,
        citizen_user_id=user.user_id if user else None,
        citizen_name=user.display_name if user else None,
        client_ip=client_ip,
    )
    saved = repository.create_complaint(complaint) or complaint
    add_notification(
        "New complaint", f"{title} was received and routed for review.", "info", saved["id"]
    )
    return saved


@router.post("/")
def create_complaint(
    request: Request,
    user: Annotated[CurrentUser, Depends(optional_user)],
    title: str = Form(..., min_length=3, max_length=TITLE_MAX),
    category: str | None = Form(None),
    description: str = Form(..., min_length=5, max_length=DESCRIPTION_MAX),
    files: List[UploadFile] = File(default=[]),
):
    complaint = _create(request, title, description, category, user)
    if files:
        # Attachments on this endpoint were silently discarded before; say so rather than
        # letting a citizen believe their photo was stored.
        complaint["attachment_warning"] = (
            "Image upload via this endpoint is not enabled yet. Send photos through the "
            "Telegram bot, which stores them against the complaint."
        )
    return complaint


@router.post("/json")
def create_complaint_json(
    request: Request,
    payload: ComplaintCreateRequest,
    user: Annotated[CurrentUser, Depends(optional_user)],
):
    return _create(request, payload.title, payload.description, payload.category, user)


@router.post("/{complaint_id}/analyze")
def analyze_complaint(complaint_id: str, user: Annotated[CurrentUser, Depends(require_staff)]):
    """Re-run classification for an existing complaint."""
    complaint = repository.get_complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")

    analysis = classify_complaint_text(f"{complaint.get('title', '')} {complaint.get('description', '')}")
    inferred_category = canonicalize_category(analysis.get("category") or complaint.get("category"))
    recommendation = recommend_worker_for_department(inferred_category, analysis.get("priority", "medium"))

    updates = {
        "category": inferred_category,
        "priority": analysis.get("priority", "medium"),
        "recommended_worker_payload": recommendation,
        "ai_analysis": analysis,
        "department": recommendation.get("department") or inferred_category,
    }
    updated = repository.update_complaint(complaint_id, updates, actor_user_id=user.user_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")
    add_notification("Complaint analyzed", f"{updated.get('title')} was analyzed and routed.", "info", complaint_id)
    return updated


@router.get("/{complaint_id}")
def get_complaint(complaint_id: str, user: Annotated[CurrentUser, Depends(optional_user)]):
    complaint = repository.get_complaint(complaint_id)
    if not complaint:
        # Previously returned an invented "Sample complaint" record with HTTP 200.
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")
    if user and not user.is_staff and complaint.get("citizen_user_id") not in (None, user.user_id):
        raise HTTPException(status_code=403, detail="You may only view your own complaints")
    return complaint


@router.post("/{complaint_id}/status")
def update_complaint_status(
    complaint_id: str,
    payload: ComplaintStatusUpdate,
    user: Annotated[CurrentUser, Depends(require_staff)],
):
    updates: dict = {"status": payload.status}
    if payload.resolution_summary is not None:
        updates["resolution_summary"] = payload.resolution_summary
    try:
        updated = repository.update_complaint(complaint_id, updates, actor_user_id=user.user_id)
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")

    add_notification("Complaint updated", f"{updated['title']} moved to {payload.status}.", "info", complaint_id)
    notify_citizen_of_status(updated, payload.status)
    return updated


@router.post("/{complaint_id}/assign")
def assign_complaint(
    complaint_id: str,
    payload: ComplaintAssignmentUpdate,
    user: Annotated[CurrentUser, Depends(require_staff)],
):
    updates: dict = {
        "department": payload.department,
        "priority": payload.priority,
        "status": payload.status,
    }
    if payload.assigned_worker_id:
        updates["assigned_worker_id"] = payload.assigned_worker_id
    try:
        updated = repository.update_complaint(complaint_id, updates, actor_user_id=user.user_id)
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")

    add_notification(
        "Complaint assigned",
        f"{updated['title']} was assigned to {payload.department}.",
        "success",
        complaint_id,
    )
    notify_citizen_of_status(updated, payload.status)
    return updated


def notify_citizen_of_status(complaint: dict, status: str) -> None:
    """Tell the citizen on Telegram that their complaint moved. Never raises."""
    try:
        from app.services.citizen_notify import notify_status_change

        notify_status_change(complaint, status)
    except Exception as exc:  # pragma: no cover - outbound notification is best-effort
        logger.warning("Citizen notification failed for %s: %s", complaint.get("id"), exc)
