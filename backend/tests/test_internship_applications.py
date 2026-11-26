from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from modules.internship import router


APPLICATIONS = "/api/public/internship/applications"
ADMIN_APPLICATIONS = "/api/superadmin/internship/applications"


@pytest.fixture
def application_api(monkeypatch):
    app = FastAPI()
    app.include_router(router.router)
    collection = MagicMock()
    monkeypatch.setattr(router, "db", {"internship_applications": collection})
    return app, TestClient(app), collection


def test_submission_validates_and_stores_name_and_phone(application_api):
    _, client, collection = application_api
    assert client.post(APPLICATIONS, json={"name": " ", "phone": "abc"}).status_code == 422
    collection.insert_one.assert_not_called()

    response = client.post(APPLICATIONS, json={"name": " Test Applicant ", "phone": "+91 90000 00000"})

    assert response.status_code == 201
    assert response.json() == {"status": "success"}
    stored = collection.insert_one.call_args.args[0]
    assert stored["name"] == "Test Applicant"
    assert stored["phone"] == "+919000000000"
    assert stored["created_at"].tzinfo == timezone.utc


@pytest.mark.parametrize(("role", "is_active"), [("Candidate", True), ("Super Admin", False)])
def test_listing_requires_an_active_super_admin(application_api, role, is_active):
    app, client, collection = application_api
    assert client.get(ADMIN_APPLICATIONS).status_code == 401

    app.dependency_overrides[router.get_current_user] = lambda: SimpleNamespace(
        role=role, is_active=is_active,
    )
    assert client.get(ADMIN_APPLICATIONS).status_code == 403
    collection.find.assert_not_called()


def test_super_admin_can_page_through_private_applications(application_api):
    app, client, collection = application_api
    app.dependency_overrides[router.get_current_user] = lambda: SimpleNamespace(
        role="Super Admin", is_active=True,
    )
    created_at = datetime(2026, 11, 26, tzinfo=timezone.utc)
    rows = [
        {"_id": ObjectId(), "name": f"Applicant {i}", "phone": "9000000000", "created_at": created_at}
        for i in range(router.PAGE_SIZE + 1)
    ]
    cursor = collection.find.return_value.sort.return_value
    cursor.limit.side_effect = [rows, rows[-1:]]

    response = client.get(ADMIN_APPLICATIONS)
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    result = response.json()
    assert len(result["applications"]) == router.PAGE_SIZE
    assert result["applications"][0]["created_at"] == created_at.isoformat()
    assert result["next_cursor"] == str(rows[-2]["_id"])

    response = client.get(ADMIN_APPLICATIONS, params={"cursor": result["next_cursor"]})
    assert response.status_code == 200
    assert response.json()["next_cursor"] is None
    collection.find.assert_called_with(
        {"_id": {"$lt": rows[-2]["_id"]}}, {"name": 1, "phone": 1, "created_at": 1},
    )
