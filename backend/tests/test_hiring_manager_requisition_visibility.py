"""Test case for verifying hiring manager requisition visibility and timestamp serialization."""
import os
import pytest
from fastapi.testclient import TestClient

from main import app, _requisition_dict, list_requisitions, _format_datetime
from modules.identity.domain.models import User
from modules.identity.router import create_access_token
from modules.shared.db import db, get_session
from modules.requisition.domain import models, schemas


def test_format_datetime_handles_str_and_datetime():
    """Verify _format_datetime handles None, str, and datetime gracefully without raising AttributeError."""
    from datetime import datetime, timezone
    assert _format_datetime(None) is None
    assert _format_datetime("") is None
    
    # ISO string
    iso_str = "2026-09-18T10:06:29.719313+00:00"
    assert _format_datetime(iso_str) == iso_str
    
    # datetime object
    dt = datetime(2026, 9, 18, 10, 6, 29, tzinfo=timezone.utc)
    assert _format_datetime(dt) == dt.isoformat()


def test_henry_requisitions_visible_and_serializable():
    """Verify that henry@privatea.com requisitions serialize without 'str' has no attribute 'isoformat' error."""
    client = TestClient(app)
    
    user_doc = db["users"].find_one({"email": "henry@privatea.com"})
    assert user_doc is not None, "henry@privatea.com user not found in database"
    user = User.from_doc(user_doc)
    
    token = create_access_token(
        data={
            "sub": user.id,
            "id": user.id,
            "role": user.role,
            "tenant_id": user.tenant_id,
        }
    )
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Fetch requisitions list as Henry
    res = client.get("/requisitions", headers=headers)
    assert res.status_code == 200, f"Failed with {res.status_code}: {res.text}"
    reqs = res.json()
    assert isinstance(reqs, list)
    assert len(reqs) >= 2, f"Expected at least 2 requisitions for Henry, got {len(reqs)}"
    
    # Check that both existing requisitions are present
    titles = [r.get("title") for r in reqs]
    assert "Frontend Engineer (React / Next.js)" in titles
    assert "Data Engineer" in titles
    
    # 2. Test individual requisition endpoints for Henry
    for req in reqs:
        req_id = req["id"]
        detail_res = client.get(f"/requisitions/{req_id}", headers=headers)
        assert detail_res.status_code == 200, f"Detail endpoint failed for {req_id}: {detail_res.text}"
        detail_data = detail_res.json()
        assert detail_data["id"] == req_id
        # Verify timestamps are valid strings or None
        assert isinstance(detail_data.get("created_at"), (str, type(None)))
        assert isinstance(detail_data.get("director_approved_at"), (str, type(None)))


def test_henry_create_and_immediate_visibility_flow():
    """Verify full end-to-end loop: Henry creates a new requisition and it is immediately visible."""
    client = TestClient(app)
    
    user_doc = db["users"].find_one({"email": "henry@privatea.com"})
    user = User.from_doc(user_doc)
    
    token = create_access_token(
        data={
            "sub": user.id,
            "id": user.id,
            "role": user.role,
            "tenant_id": user.tenant_id,
        }
    )
    headers = {"Authorization": f"Bearer {token}"}
    
    # Fetch an existing company profile for this tenant
    with get_session() as session:
        prof = session.query(models.CompanyProfile).filter(
            models.CompanyProfile.tenant_id == user.tenant_id
        ).first()
        if not prof:
            prof = session.query(models.CompanyProfile).first()
    
    assert prof is not None, "Need a company profile to create requisition"
    
    test_title = f"Automated Test Role {os.urandom(3).hex().upper()}"
    create_payload = {
        "company_profile_id": prof.id,
        "title": test_title,
        "description": "Verification of hiring manager requisition creation loop.",
        "tech_stack_hint": ["Python", "FastAPI"],
        "intake_mode": "guided",
        "prefill": {
            "title": test_title,
            "start_date": "2026-10-01",
            "ends_on": "2027-04-01",
            "extension_likely": True,
            "vendor_candidate_limit": 2,
            "hiring_manager": user.name or "Henry HH",
        }
    }
    
    create_res = client.post("/requisitions", json=create_payload, headers=headers)
    assert create_res.status_code == 201, f"Create requisition failed: {create_res.text}"
    created_req = create_res.json()
    created_id = created_req["id"]
    assert created_id is not None
    
    try:
        # Start AI intake flow
        start_res = client.post(f"/requisitions/{created_id}/start", headers=headers)
        assert start_res.status_code == 200, f"Start intake failed: {start_res.text}"
        
        # Verify immediate visibility in listing
        list_res = client.get("/requisitions", headers=headers)
        assert list_res.status_code == 200
        active_list = list_res.json()
        ids = [r["id"] for r in active_list]
        assert created_id in ids, f"Newly created requisition {created_id} not visible in list for Henry!"
    finally:
        # Cleanup test requisition
        try:
            with get_session() as session:
                req_obj = session.get(models.Requisition, created_id)
                if req_obj:
                    session.delete(req_obj)
                    session.commit()
            db["requisitions"].delete_one({"id": created_id})
        except Exception:
            pass


def test_director_requisition_listing_no_internal_server_error():
    """Verify that director requisition listing serializes without 'str' has no attribute 'isoformat' 500 error."""
    client = TestClient(app)
    
    dir_doc = db["users"].find_one({"role": "Director"})
    if not dir_doc:
        return
    director = User.from_doc(dir_doc)
    
    token = create_access_token(
        data={
            "sub": director.id,
            "id": director.id,
            "role": director.role,
            "tenant_id": director.tenant_id,
        }
    )
    headers = {"Authorization": f"Bearer {token}"}
    
    res = client.get("/requisitions", headers=headers)
    assert res.status_code == 200, f"Director /requisitions failed with {res.status_code}: {res.text}"
    reqs = res.json()
    assert isinstance(reqs, list)
    for r in reqs:
        assert isinstance(r.get("created_at"), (str, type(None)))
        assert isinstance(r.get("director_approved_at"), (str, type(None)))


if __name__ == "__main__":
    print("Running test_format_datetime_handles_str_and_datetime...")
    test_format_datetime_handles_str_and_datetime()
    print("Running test_henry_requisitions_visible_and_serializable...")
    test_henry_requisitions_visible_and_serializable()
    print("Running test_henry_create_and_immediate_visibility_flow...")
    test_henry_create_and_immediate_visibility_flow()
    print("Running test_director_requisition_listing_no_internal_server_error...")
    test_director_requisition_listing_no_internal_server_error()
    print("ALL TESTS PASSED SUCCESSFULLY!")
