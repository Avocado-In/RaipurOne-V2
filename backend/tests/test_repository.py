from app.services.repository import get_complaint_repository, normalize_complaint_for_storage


def test_normalize_complaint_for_storage_maps_api_payload_to_database_shape():
    payload = normalize_complaint_for_storage(
        {
            "title": "Blocked drain near school",
            "description": "Water is pooling and causing a hazard.",
            "category": "Sanitation",
            "priority": "high",
            "status": "submitted",
        }
    )

    assert payload["title"] == "Blocked drain near school"
    assert payload["priority"] == "high"
    assert payload["status"] == "submitted"
    assert payload["category"] == "Sanitation"


def test_repository_falls_back_to_in_memory_store():
    repo = get_complaint_repository()
    complaint = repo.create_complaint(
        {
            "id": "CMP-9000",
            "title": "Database migration test",
            "priority": "medium",
            "status": "submitted",
            "category": "sanitation",
            "department": "Dispatch",
            "description": "Testing repository layer",
            "citizen_name": "Citizen",
            "assigned_worker": None,
        }
    )

    stored = repo.get_complaint(complaint["id"])
    assert stored is not None
    assert stored["title"] == "Database migration test"
