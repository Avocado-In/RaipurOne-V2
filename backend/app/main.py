import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.repository import get_complaint_repository

try:
    from .api.routes import ai, auth, complaints, images, notifications, workers
except ImportError:  # pragma: no cover - fallback for direct script execution
    from app.api.routes import ai, auth, complaints, images, notifications, workers

app = FastAPI(title="Smart Grievance Management API", version="0.1.0")

allowed_origins = [
    origin.strip()
    for origin in settings.cors_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(complaints.router, prefix="/complaints", tags=["complaints"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(images.router, prefix="/images", tags=["images"])
app.include_router(workers.router, prefix="/workers", tags=["workers"])

repository = get_complaint_repository()


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/tickets")
def list_legacy_tickets():
    complaints = repository.list_complaints()
    return [
        {
            "_id": complaint.get("id"),
            "ticketId": complaint.get("id"),
            "id": complaint.get("id"),
            "title": complaint.get("title"),
            "description": complaint.get("description"),
            "query": complaint.get("description") or complaint.get("message"),
            "category": complaint.get("category"),
            "department": complaint.get("department") or complaint.get("category", "").title(),
            "priority": complaint.get("priority"),
            "status": complaint.get("status"),
            "citizenName": complaint.get("citizen_name"),
            "assignedWorker": complaint.get("assigned_worker"),
            "submittedAt": complaint.get("submitted_at"),
            "createdAt": complaint.get("created_at"),
            "updatedAt": complaint.get("updated_at"),
        }
        for complaint in complaints
    ]


@app.get("/tickets/{ticket_id}")
def get_legacy_ticket(ticket_id: str):
    complaint = repository.get_complaint(ticket_id)
    if complaint:
        return {
            "_id": complaint.get("id"),
            "ticketId": complaint.get("id"),
            "id": complaint.get("id"),
            "title": complaint.get("title"),
            "description": complaint.get("description"),
            "query": complaint.get("description") or complaint.get("message"),
            "category": complaint.get("category"),
            "department": complaint.get("department") or complaint.get("category", "").title(),
            "priority": complaint.get("priority"),
            "status": complaint.get("status"),
            "citizenName": complaint.get("citizen_name"),
            "assignedWorker": complaint.get("assigned_worker"),
            "submittedAt": complaint.get("submitted_at"),
            "createdAt": complaint.get("created_at"),
            "updatedAt": complaint.get("updated_at"),
        }
    return {"id": ticket_id, "status": "not_found"}


@app.patch("/tickets/{ticket_id}/status")
def update_legacy_ticket_status(ticket_id: str, payload: dict):
    updated = repository.update_complaint(ticket_id, {"status": payload.get("status")})
    if updated:
        return updated
    return {"id": ticket_id, "status": payload.get("status")}


@app.post("/tickets/{ticket_id}/response")
def add_legacy_ticket_response(ticket_id: str, payload: dict):
    return {"ticketId": ticket_id, "message": payload.get("message"), "status": "ok"}


@app.get("/dashboard/stats")
def get_dashboard_stats():
    complaints = repository.list_complaints()
    statuses = [complaint.get("status", "") for complaint in complaints]
    total = len(complaints)
    open_count = sum(1 for status in statuses if status in {"submitted", "assigned", "in_progress", "under_review"})
    resolved_count = sum(1 for status in statuses if status in {"resolved", "closed"})
    in_progress_count = sum(1 for status in statuses if status == "in_progress")
    return {
        "success": True,
        "data": {
            "totalTickets": total,
            "openTickets": open_count,
            "resolvedTickets": resolved_count,
            "inProgressTickets": in_progress_count,
            "totalUsers": 8,
        },
    }



