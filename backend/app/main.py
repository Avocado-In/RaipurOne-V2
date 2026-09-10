import logging
import os
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.domain import InvalidStatusTransition
from app.core.security import CurrentUser, require_staff
from app.services.repository import get_complaint_repository

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("raipurone.api")

try:
    from .api.routes import ai, analytics, auth, complaints, images, notifications, worker_app, workers
except ImportError:  # pragma: no cover - fallback for direct script execution
    from app.api.routes import ai, analytics, auth, complaints, images, notifications, worker_app, workers

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

@app.exception_handler(InvalidStatusTransition)
async def _invalid_transition_handler(request: Request, exc: InvalidStatusTransition):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(complaints.router, prefix="/complaints", tags=["complaints"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(images.router, prefix="/images", tags=["images"])
app.include_router(workers.router, prefix="/workers", tags=["workers"])
# The field worker app: its own mobile page at /worker plus the endpoints it and the
# dashboard's review screen call.
app.include_router(worker_app.router, prefix="/worker", tags=["worker-app"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])

repository = get_complaint_repository()


@app.get("/health")
def health_check():
    """Report real subsystem state rather than an unconditional "ok"."""
    from app.services.ai_service import ai_provider
    from app.services.repository import SupabaseComplaintRepository

    supabase_ok = False
    detail = None
    try:
        repository.list_complaints()
        supabase_ok = True
    except Exception as exc:  # pragma: no cover - reported, not raised
        detail = str(exc)[:200]

    return {
        "status": "ok" if supabase_ok else "degraded",
        "storage": {
            "mode": settings.storage_mode,
            "backend": type(repository).__name__,
            "supabase_reachable": supabase_ok,
            "demo_fallback_allowed": settings.allow_demo_fallback,
            "error": detail,
        },
        "ai": {"configured": settings.ai_provider, "active": ai_provider.active_name},
        "auth": {"required": settings.require_auth},
        "telegram": {"token_configured": bool(settings.telegram_bot_token)},
    }


@app.get("/tickets")
def list_legacy_tickets():
    complaints = repository.list_complaints()
    return [
        {
            "_id": complaint.get("id"),
            "ticketId": complaint.get("id"),
            "ticket_id": complaint.get("id"),
            "id": complaint.get("id"),
            "title": complaint.get("title"),
            "description": complaint.get("description"),
            "query": complaint.get("description") or complaint.get("message"),
            "category": complaint.get("category"),
            "department": complaint.get("department") or complaint.get("category", "").title(),
            "priority": complaint.get("priority"),
            "status": complaint.get("status"),
            "citizenName": complaint.get("citizen_name") or complaint.get("username") or "Anonymous",
            "citizen_name": complaint.get("citizen_name") or complaint.get("username") or "Anonymous",
            "username": complaint.get("citizen_name") or complaint.get("username") or "Anonymous",
            "firstName": complaint.get("citizen_name") or complaint.get("first_name") or complaint.get("username") or "Anonymous",
            "first_name": complaint.get("citizen_name") or complaint.get("first_name") or complaint.get("username") or "Anonymous",
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
            "ticket_id": complaint.get("id"),
            "id": complaint.get("id"),
            "title": complaint.get("title"),
            "description": complaint.get("description"),
            "query": complaint.get("description") or complaint.get("message"),
            "category": complaint.get("category"),
            "department": complaint.get("department") or complaint.get("category", "").title(),
            "priority": complaint.get("priority"),
            "status": complaint.get("status"),
            "citizenName": complaint.get("citizen_name") or complaint.get("username") or "Anonymous",
            "citizen_name": complaint.get("citizen_name") or complaint.get("username") or "Anonymous",
            "username": complaint.get("citizen_name") or complaint.get("username") or "Anonymous",
            "firstName": complaint.get("citizen_name") or complaint.get("first_name") or complaint.get("username") or "Anonymous",
            "first_name": complaint.get("citizen_name") or complaint.get("first_name") or complaint.get("username") or "Anonymous",
            "assignedWorker": complaint.get("assigned_worker"),
            "submittedAt": complaint.get("submitted_at"),
            "createdAt": complaint.get("created_at"),
            "updatedAt": complaint.get("updated_at"),
        }
    raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")


@app.patch("/tickets/{ticket_id}/status")
def update_legacy_ticket_status(
    ticket_id: str,
    payload: dict,
    user: Annotated[CurrentUser, Depends(require_staff)],
):
    try:
        updated = repository.update_complaint(
            ticket_id, {"status": payload.get("status")}, actor_user_id=user.user_id
        )
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not updated:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    from app.api.routes.complaints import notify_citizen_of_status, settle_worker_submission

    # This is the route the ticket screen uses, so a complaint resolved from there must
    # also clear whatever the worker left waiting in the review queue.
    settle_worker_submission(ticket_id, str(payload.get("status")), user.user_id)
    notify_citizen_of_status(updated, str(payload.get("status")))
    return updated


@app.post("/tickets/{ticket_id}/response")
def add_legacy_ticket_response(
    ticket_id: str,
    payload: dict,
    user: Annotated[CurrentUser, Depends(require_staff)],
):
    """Send a staff reply to the citizen on Telegram."""
    complaint = repository.get_complaint(ticket_id)
    if not complaint:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    message = str(payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="A message is required")

    delivered = False
    chat_id = complaint.get("telegram_chat_id")
    if chat_id:
        from app.services.citizen_notify import send_message, short_reference

        reply = f"Complaint {short_reference(ticket_id)}\n\n💬 {message}"
        delivered = send_message(chat_id, reply)
    return {"ticketId": ticket_id, "message": message, "delivered": delivered, "status": "ok"}


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



