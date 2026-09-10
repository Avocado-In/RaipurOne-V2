"""The field worker app: who may use it, and what makes a submission acceptable.

The point of these tests is the proof rules. A worker marking a job done is only worth
anything if the photo is fresh, the GPS fix is real, and - when the complaint has
coordinates - the worker was actually standing at the site. Each of those refusals is
asserted here, because losing one silently turns the whole flow back into "the worker
pressed a button".
"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes import worker_app  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.main import app  # noqa: E402
from app.services.repository import get_complaint_repository  # noqa: E402
from app.services.work_submissions import haversine_metres  # noqa: E402

client = TestClient(app)

WORKER_ID = "11111111-1111-1111-1111-111111111111"
WORKER_USER_ID = "22222222-2222-2222-2222-222222222222"
COMPLAINT_ID = "CMP-1024"

# Raipur railway station, and a point roughly 4 km away.
SITE = (21.2381, 81.6337)
FAR_AWAY = (21.2745, 81.6337)

ONE_PIXEL_JPEG = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb004300"
    + "ff" * 64
    + "ffd9"
)


def worker_headers(role: str = "worker") -> dict[str, str]:
    token = create_access_token(WORKER_USER_ID, "worker_test", role)
    return {"Authorization": f"Bearer {token['access_token']}"}


class FakeStore:
    """Stands in for the work_submissions table."""

    def __init__(self) -> None:
        self.rows: list[dict] = []

    def pending_for_complaint(self, complaint_id):
        return next(
            (row for row in self.rows if row["complaint_id"] == complaint_id and row["status"] == "pending"),
            None,
        )

    def create(self, submission):
        row = {**submission, "id": f"sub-{len(self.rows) + 1}"}
        self.rows.append(row)
        return row

    def list_for_worker(self, worker_id, limit=20):
        return [row for row in self.rows if row["worker_id"] == worker_id][:limit]


@pytest.fixture
def field_worker(monkeypatch):
    """A signed-in worker holding CMP-1024, with photo storage and the table stubbed out."""
    monkeypatch.setattr(
        worker_app,
        "find_worker_for_user",
        lambda user_id: {
            "id": WORKER_ID,
            "user_id": user_id,
            "employee_code": "EMP-TEST",
            "name": "worker_test",
            "designation": "Tester",
            "department": "Roads & Public Works",
            "phone": "",
        },
    )

    store = FakeStore()
    monkeypatch.setattr(worker_app, "get_submission_store", lambda: store)

    repository = get_complaint_repository()
    complaint = repository.get_complaint(COMPLAINT_ID)
    original = dict(complaint)
    complaint.update(
        {"status": "assigned", "assigned_worker_id": WORKER_ID, "location_lat": None, "location_lng": None}
    )

    uploads: list[str] = []
    monkeypatch.setattr(
        repository,
        "upload_complaint_image",
        lambda cid, content, filename, content_type="image/jpeg": uploads.append(filename) or {},
        raising=False,
    )

    yield {"store": store, "complaint": complaint, "uploads": uploads}

    complaint.clear()
    complaint.update(original)


def submit(**overrides):
    data = {"lat": SITE[0], "lng": SITE[1], "accuracy_m": 12, "notes": "Pothole filled"}
    data.update(overrides)
    return client.post(
        f"/worker/tasks/{COMPLAINT_ID}/submit",
        headers=worker_headers(),
        data={key: value for key, value in data.items() if value is not None},
        files={"photo": ("work.jpg", ONE_PIXEL_JPEG, "image/jpeg")},
    )


# --- Distance ---------------------------------------------------------------

def test_haversine_matches_known_distance():
    # Raipur station to a point 4 km due north, within a metre or two.
    assert haversine_metres(*SITE, *FAR_AWAY) == pytest.approx(4046, abs=20)


def test_haversine_is_zero_for_the_same_point():
    assert haversine_metres(*SITE, *SITE) == pytest.approx(0, abs=0.001)


# --- Access -----------------------------------------------------------------

def test_worker_page_is_served_without_a_login():
    response = client.get("/worker")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_tasks_require_authentication():
    assert client.get("/worker/tasks").status_code == 401


def test_citizens_are_turned_away():
    response = client.get("/worker/tasks", headers=worker_headers(role="citizen"))
    assert response.status_code == 403


def test_login_without_a_worker_record_is_rejected():
    # find_worker_for_user is not patched here, so no worker row is found.
    response = client.get("/worker/me", headers=worker_headers())
    assert response.status_code == 403
    assert "not linked to a worker record" in response.json()["detail"]


def test_worker_only_sees_their_own_open_tasks(field_worker):
    response = client.get("/worker/tasks", headers=worker_headers())
    assert response.status_code == 200
    tasks = response.json()["tasks"]
    assert [task["id"] for task in tasks] == [COMPLAINT_ID]


def test_worker_cannot_submit_a_task_assigned_to_someone_else(field_worker):
    field_worker["complaint"]["assigned_worker_id"] = "99999999-9999-9999-9999-999999999999"
    assert submit().status_code == 403


# --- Proof rules ------------------------------------------------------------

def test_submission_without_a_photo_is_refused(field_worker):
    response = client.post(
        f"/worker/tasks/{COMPLAINT_ID}/submit",
        headers=worker_headers(),
        data={"lat": SITE[0], "lng": SITE[1]},
    )
    assert response.status_code == 422


def test_submission_without_a_location_is_refused(field_worker):
    response = client.post(
        f"/worker/tasks/{COMPLAINT_ID}/submit",
        headers=worker_headers(),
        data={"notes": "done"},
        files={"photo": ("work.jpg", ONE_PIXEL_JPEG, "image/jpeg")},
    )
    assert response.status_code == 422


def test_a_vague_gps_fix_is_not_proof_of_presence(field_worker):
    response = submit(accuracy_m=settings.work_max_gps_accuracy_metres + 50)
    assert response.status_code == 422
    assert "accurate" in response.json()["detail"]


def test_an_old_photo_is_refused(field_worker):
    stale = 1_600_000_000_000  # September 2020, in milliseconds
    response = submit(photo_taken_at=stale)
    assert response.status_code == 422
    assert "fresh photo" in response.json()["detail"]


def test_submitting_from_outside_the_geofence_is_refused(field_worker):
    field_worker["complaint"].update({"location_lat": SITE[0], "location_lng": SITE[1]})
    response = submit(lat=FAR_AWAY[0], lng=FAR_AWAY[1])
    assert response.status_code == 422
    assert "from the complaint location" in response.json()["detail"]
    assert field_worker["store"].rows == []


def test_submitting_at_the_site_is_accepted_and_marked_verified(field_worker):
    field_worker["complaint"].update({"location_lat": SITE[0], "location_lng": SITE[1]})
    response = submit()
    assert response.status_code == 200
    body = response.json()
    assert body["location_verified"] is True
    assert body["distance_m"] < 50
    assert body["complaint"]["status"] == "under_review"


def test_a_complaint_without_coordinates_still_accepts_work_but_stays_unverified(field_worker):
    # Every Telegram complaint currently in the database is in this state, so refusing
    # these outright would make the app unusable.
    response = submit()
    assert response.status_code == 200
    body = response.json()
    assert body["location_verified"] is False
    assert body["distance_m"] is None
    assert field_worker["store"].rows[0]["lat"] == pytest.approx(SITE[0])


def test_the_same_task_cannot_be_submitted_twice(field_worker):
    assert submit().status_code == 200
    second = submit()
    assert second.status_code == 409


def test_submitting_records_the_photo_and_the_worker(field_worker):
    assert submit().status_code == 200
    assert len(field_worker["uploads"]) == 1
    row = field_worker["store"].rows[0]
    assert row["worker_id"] == WORKER_ID
    assert row["worker_user_id"] == WORKER_USER_ID
    assert row["photo_path"].startswith(f"{COMPLAINT_ID}/work-")
    assert row["status"] == "pending"
