from fastapi import APIRouter, HTTPException

from app.services.repository import get_complaint_repository

router = APIRouter()


@router.get("/ticket/{complaint_id}")
def list_ticket_images(complaint_id: str):
    repository = get_complaint_repository()
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
