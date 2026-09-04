import mongomock
import pytest
from fastapi.exceptions import HTTPException
from modules.identity.domain.models import User
from modules.requisition.domain.models import Requisition, CompanyProfile
from modules.requisition.domain.schemas import RoleIntent
from modules.requisition.services.requisition_service import RequisitionService
from modules.shared.db import Session
import main as app_main

def test_full_director_approval_workflow(monkeypatch):
    database = mongomock.MongoClient()["test_dir_workflow"]
    def factory():
        return Session(database)
    monkeypatch.setattr(app_main, "get_session", factory)
    service = RequisitionService(session_factory=factory)
    monkeypatch.setattr(app_main, "service", service)

    with factory() as session:
        prof = CompanyProfile(name="Test Corp", tenant_id="local", tech_stack=["Python", "Django", "Postgres"])
        session.add(prof)
        session.commit()
        session.refresh(prof)
        profile_id = prof.id

    # Create users
    hm_user = User(id="u-hm-1", tenant_id="local", role="Hiring Manager", name="Alice HM")
    dir_user = User(id="u-dir-1", tenant_id="local", role="Director", name="Bob Director")

    # 1. HM creates a requisition
    req_obj = service.create(
        profile_id,
        RoleIntent(title="Senior Backend Dev", description="Python APIs"),
        created_by=hm_user.id,
        tenant_id="local"
    )
    req_id = req_obj.id

    # Drive intake until approval checkpoint is reached
    _, interrupt = service.start_intake(req_id)
    answers = ["Senior", "5 years", "Remote", "₹15L", "6 months"]
    while isinstance(interrupt, str) and answers:
        _, interrupt = service.answer(req_id, answers.pop(0))

    # 2. HM clicks "Proceed to Approval" -> calls approve_requisition endpoint
    app_main.approve_requisition(req_id, current_user=hm_user)

    req_after_submit = app_main._get_requisition(req_id)
    assert req_after_submit.status == "PendingApproval"
    assert req_after_submit.director_approved is False

    # 3. HM tries to publish before Director approval -> fails with 400
    with pytest.raises(HTTPException) as exc:
        app_main.publish_requisition(req_id, current_user=hm_user)
    assert exc.value.status_code == 400
    assert "Director approval" in exc.value.detail

    # 4. Director approves requisition
    resp = app_main.director_approve_requisition(req_id, current_user=dir_user)
    assert resp["director_approved"] is True
    assert resp["director_approved_by"] == "Bob Director"

    # 5. HM can now publish to vendors
    pub_resp = app_main.publish_requisition(req_id, current_user=hm_user)
    assert pub_resp["status"] == "Published"
