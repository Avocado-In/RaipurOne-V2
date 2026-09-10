import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_complaints_returns_seed_data():
    response = client.get('/complaints/')
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) >= 1


def test_create_complaint_persists_and_returns_payload():
    response = client.post(
        '/complaints/',
        data={
            'title': 'Blocked drain near school',
            'category': 'Sanitation',
            'description': 'Water is pooling and causing a hazard.',
        },
        files=[],
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['title'] == 'Blocked drain near school'
    assert payload['status'] == 'submitted'


def test_assign_complaint_requires_staff_authentication():
    response = client.post(
        '/complaints/CMP-1024/assign',
        json={
            'department': 'Sanitation',
            'priority': 'high',
            'status': 'assigned',
        },
    )
    assert response.status_code == 401


def test_assign_complaint_updates_department_priority_and_status(staff_headers):
    response = client.post(
        '/complaints/CMP-1024/assign',
        json={
            'department': 'Sanitation',
            'priority': 'high',
            'status': 'assigned',
        },
        headers=staff_headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['department'] == 'Sanitation'
    assert payload['priority'] == 'high'
    assert payload['status'] == 'assigned'


def test_analyze_complaint_reclassifies_and_updates_ai_payload(staff_headers):
    response = client.post('/complaints/CMP-1024/analyze', headers=staff_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload['id'] == 'CMP-1024'
    assert payload['category'] in {'Sanitation', 'Street Lights', 'Water Supply', 'Health care', 'road', 'Others'}
    assert payload['priority'] in {'high', 'medium'}
    assert 'ai_analysis' in payload


def test_notifications_endpoint_returns_seed_data():
    response = client.get('/notifications/')
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 1
