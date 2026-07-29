from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.routes.notifications import add_notification
from app.services.repository import get_complaint_repository

router = APIRouter()


class WorkerCreate(BaseModel):
    worker_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    phone: str = ""
    email: str = ""
    departments: list[str] = []


class WorkerAssignment(BaseModel):
    ticketId: str
    workerId: str
    message: str = ""
    deadline: str = ""
    forwardImages: bool = True
    forwardLocation: bool = True
    ticketDetails: dict = {}


@router.get("")
def list_workers():
    return {"success": True, "data": get_complaint_repository().list_workers()}


@router.get("/available")
def list_available_workers(department: str = "", category: str = ""):
    workers = get_complaint_repository().list_workers()
    requested = {value.strip().upper() for value in (department, category) if value.strip()}
    available = [
        worker for worker in workers
        if worker.get("status") in {"available", "busy"}
        and (not requested or requested.intersection({str(item).upper() for item in worker.get("departments", [])}) or "GENERAL" in {str(item).upper() for item in worker.get("departments", [])})
    ]
    return {"success": True, "workers": available}


@router.post("")
def create_worker(payload: WorkerCreate):
    repository = get_complaint_repository()
    if repository.get_worker(payload.worker_id):
        raise HTTPException(status_code=409, detail="Worker ID already exists")
    try:
        worker = repository.create_worker(payload.model_dump())
        return {"success": True, "data": worker}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to create worker: {exc}") from exc


@router.post("/assign")
def assign_worker(payload: WorkerAssignment):
    repository = get_complaint_repository()
    worker = repository.get_worker(payload.workerId)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    updated = repository.update_complaint(payload.ticketId, {
        "assigned_worker_id": worker.get("id") or worker.get("worker_id"),
        "assigned_worker": worker.get("name"),
        "status": "assigned",
    })
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint not found")
    add_notification("Complaint assigned", f"{updated.get('title', payload.ticketId)} was assigned to {worker.get('name')}.", "success", payload.ticketId)
    return {"success": True, "data": updated, "worker": worker}
