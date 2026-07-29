from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ai_service import ai_provider

router = APIRouter()


class ComplaintAnalysisRequest(BaseModel):
    text: str
    department: str = "public_works"
    priority: str = "medium"


def classify_complaint_text(text: str) -> dict:
    return ai_provider.classify(text)


def recommend_worker_for_department(department: str, priority: str = "medium") -> dict:
    return ai_provider.recommend_worker(department, priority)


@router.get("/status")
def ai_status():
    return {"status": "active", "mode": "provider_adapter", "provider": type(ai_provider).__name__, "message": "AI inference is supplied through the AIProvider boundary."}


@router.post("/classify")
def classify_complaint(payload: ComplaintAnalysisRequest):
    return classify_complaint_text(payload.text)


@router.post("/recommend-worker")
def recommend_worker(payload: ComplaintAnalysisRequest):
    return recommend_worker_for_department(payload.department, payload.priority)
