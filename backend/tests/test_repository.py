from app.services.repository import (
    InMemoryComplaintRepository,
    SupabaseComplaintRepository,
    get_complaint_repository,
    normalize_complaint_for_storage,
)


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


def test_normalize_complaint_for_storage_canonicalizes_legacy_broad_labels():
    payload = normalize_complaint_for_storage(
        {
            "title": "Legacy infrastructure complaint",
            "description": "This should not stay on a broad bucket after normalization.",
            "category": "infrastructure",
            "priority": "medium",
            "status": "submitted",
        }
    )

    assert payload["category"] == "Others"


def test_repository_uses_the_in_memory_store_when_supabase_is_not_configured():
    """Without credentials the factory serves the in-memory store used by dev and tests.

    It is deliberately not a fallback: when Supabase *is* configured the repository
    surfaces its errors instead of quietly writing complaints nowhere.
    """
    repo = get_complaint_repository()
    assert isinstance(repo, InMemoryComplaintRepository)
    assert not isinstance(repo, SupabaseComplaintRepository)

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


# --- Category -> department routing ----------------------------------------

def test_every_complaint_category_routes_to_a_department():
    """Categories and departments are separate vocabularies.

    Matching them by string equality found workers for only 3 of the 14 categories -
    a "Roads" complaint never reached a "Roads & Public Works" worker - so every
    category must have an entry here.
    """
    import typing

    from app.core.domain import CategoryLiteral, CATEGORY_TO_DEPARTMENT, department_for_category

    for category in typing.get_args(CategoryLiteral):
        assert category in CATEGORY_TO_DEPARTMENT, f"{category} has no department"
        assert department_for_category(category)


def test_department_names_pass_through_unchanged():
    from app.core.domain import department_for_category

    assert department_for_category("Roads") == "Roads & Public Works"
    assert department_for_category("Roads & Public Works") == "Roads & Public Works"
    assert department_for_category("Street Lights") == "Electricity"
    assert department_for_category("") == "Other"
