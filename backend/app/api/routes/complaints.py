import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from app.api.routes.ai import classify_complaint_text, recommend_worker_for_department
from app.api.routes.notifications import add_notification
from app.services.repository import get_complaint_repository

router = APIRouter()

repository = get_complaint_repository()


@router.get("/")
def list_complaints():
    return repository.list_complaints()


@router.post("/")
def create_complaint(
    title: str = Form(...),
    category: str = Form(...),
    description: str = Form(...),
    files: List[UploadFile] = File(default=[]),
):
    analysis = classify_complaint_text(f"{title} {description}")
    recommendation = recommend_worker_for_department(category, analysis["priority"])
    complaint_id = str(uuid.uuid4())
    complaint = {
        "id": complaint_id,
        "citizen_user_id": None,
        "citizen_name": "Citizen",
        "title": title,
        "description": description,
        "category": category,
        "department_id": None,
        "department": category.title(),
        "priority": analysis["priority"],
        "status": "submitted",
        "assigned_worker_id": None,
        "assigned_worker": recommendation["recommended_worker"],
        "recommended_worker_id": None,
        "recommended_worker_payload": recommendation,
        "ai_analysis": analysis,
        "location_text": None,
        "location_lat": None,
        "location_lng": None,
        "submitted_by_ip": None,
        "resolution_summary": None,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None,
        "closed_at": None,
    }
    repository.create_complaint(complaint)
    add_notification("New complaint", f"{title} was received and routed for review.", "info", complaint_id)
    return complaint


class ComplaintStatusUpdate(BaseModel):
    status: str


class ComplaintAssignmentUpdate(BaseModel):
    department: str
    priority: str
    status: str


@router.get("/{complaint_id}")
def get_complaint(complaint_id: str):
    complaint = repository.get_complaint(complaint_id)
    if complaint:
        return complaint
    return {"id": complaint_id, "title": "Sample complaint", "status": "in_review"}


@router.post("/{complaint_id}/status")
def update_complaint_status(complaint_id: str, payload: ComplaintStatusUpdate):
    updated = repository.update_complaint(complaint_id, {"status": payload.status})
    if updated:
        add_notification("Complaint updated", f"{updated['title']} moved to {payload.status}.", "info", complaint_id)
        return updated
    return {"id": complaint_id, "status": payload.status}


@router.post("/{complaint_id}/assign")
def assign_complaint(complaint_id: str, payload: ComplaintAssignmentUpdate):
    updated = repository.update_complaint(
        complaint_id,
        {"department": payload.department, "priority": payload.priority, "status": payload.status},
    )
    if updated:
        add_notification("Complaint assigned", f"{updated['title']} was assigned to {payload.department}.", "success", complaint_id)
        return updated
    return {"id": complaint_id, **payload.dict()}
