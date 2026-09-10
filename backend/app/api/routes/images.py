from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import CurrentUser, current_user
from app.services.repository import get_complaint_repository

router = APIRouter()


@router.get("/ticket/{complaint_id}")
def list_ticket_images(complaint_id: str, user: Annotated[CurrentUser, Depends(current_user)]):
    """Signed image URLs for one complaint.

    Requires a token: anyone who could guess a complaint id could previously mint fresh
    signed URLs for its photos, which made the private bucket pointless.
    """
    repository = get_complaint_repository()
    complaint = repository.get_complaint(complaint_id)
    if complaint is None:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id} not found")
    if not user.is_staff and complaint.get("citizen_user_id") not in (None, user.user_id):
        raise HTTPException(status_code=403, detail="You may only view your own complaint images")
    if not hasattr(repository, "list_complaint_images"):
        return {"success": True, "images": []}
    try:
        images = repository.list_complaint_images(complaint_id)
        result = []
        for image in images:
            item = dict(image)
            if hasattr(repository, "create_signed_image_url"):
                item["url"] = repository.create_signed_image_url(item["storage_path"])
            result.append(item)
        return {"success": True, "images": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to load complaint images: {exc}") from exc
