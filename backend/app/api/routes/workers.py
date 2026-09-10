from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.routes.notifications import add_notification
from app.core.domain import InvalidStatusTransition, department_for_category
from app.core.security import CurrentUser, require_admin, require_staff
from app.services.repository import get_complaint_repository

router = APIRouter()


def _normalize_worker_payload(payload: "WorkerCreate") -> dict:
    departments = [str(item).strip() for item in (payload.departments or []) if str(item).strip()]
    return {
        "id": payload.worker_id,
        "worker_id": payload.worker_id,
        "name": payload.name,
        "phone": payload.phone or "",
        "phone_number": payload.phone or "",
        "email": payload.email or "",
        "departments": departments,
        "status": "available",
        "is_active": True,
        "active_tasks": 0,
        "completed_tasks": 0,
        "rating": 0,
        "work_type": ", ".join(departments) or "General",
    }


class WorkerCreate(BaseModel):
    worker_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(default="", max_length=20)
    email: str = Field(default="", max_length=254)
    departments: list[str] = Field(default_factory=list, max_length=10)


class WorkerAssignment(BaseModel):
    ticketId: str
    workerId: str
    message: str = ""
    deadline: str = ""
    forwardImages: bool = True
    forwardLocation: bool = True
    ticketDetails: dict = {}


@router.get("")
def list_workers(user: Annotated[CurrentUser, Depends(require_staff)]):
    return {"success": True, "data": get_complaint_repository().list_workers()}


@router.get("/available")
def list_available_workers(
    user: Annotated[CurrentUser, Depends(require_staff)],
    department: str = "",
    category: str = "",
):
    workers = get_complaint_repository().list_workers()
    on_duty = [worker for worker in workers if worker.get("status") in {"available", "busy"}]

    # Callers pass a complaint's category or department interchangeably; route both
    # through the same table so a "Roads" complaint reaches "Roads & Public Works"
    # workers instead of matching nobody.
    requested = {
        department_for_category(value).strip().upper()
        for value in (department, category)
        if str(value).strip()
    }
    if not requested:
        return {"success": True, "workers": on_duty, "matched_department": None}

    def covers(worker: dict) -> bool:
        owned = {str(item).strip().upper() for item in worker.get("departments", [])}
        return bool(requested & owned) or "GENERAL" in owned

    available = [worker for worker in on_duty if covers(worker)]
    matched = sorted(requested)[0]

    if available:
        return {"success": True, "workers": available, "matched_department": matched}

    # No worker covers this department - several categories ("Others", "Education",
    # "Public Transport") have no department staffed at all. Returning an empty list
    # left the administrator with no way to assign the complaint to anyone, so offer
    # everyone on duty and say why.
    return {
        "success": True,
        "workers": on_duty,
        "matched_department": matched,
        "exact_department_match": False,
        "notice": f"No worker is assigned to {matched}. Showing all workers on duty.",
    }


@router.post("")
def create_worker(payload: WorkerCreate, user: Annotated[CurrentUser, Depends(require_admin)]):
    repository = get_complaint_repository()
    normalized_worker = _normalize_worker_payload(payload)
    if repository.get_worker(payload.worker_id):
        raise HTTPException(status_code=409, detail="Worker ID already exists")
    try:
        worker = repository.create_worker(normalized_worker)
        return {"success": True, "data": worker}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to create worker: {exc}") from exc


@router.post("/assign")
def assign_worker(payload: WorkerAssignment, user: Annotated[CurrentUser, Depends(require_staff)]):
    repository = get_complaint_repository()
    worker = repository.get_worker(payload.workerId)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    try:
        updated = repository.update_complaint(
            payload.ticketId,
            {
                "assigned_worker_id": worker.get("id") or worker.get("worker_id"),
                "assigned_worker": worker.get("name"),
                "status": "assigned",
            },
            actor_user_id=user.user_id,
        )
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint not found")
    add_notification("Complaint assigned", f"{updated.get('title', payload.ticketId)} was assigned to {worker.get('name')}.", "success", payload.ticketId)
    from app.api.routes.complaints import notify_citizen_of_status

    notify_citizen_of_status(updated, "assigned")
    return {"success": True, "data": updated, "worker": worker}
