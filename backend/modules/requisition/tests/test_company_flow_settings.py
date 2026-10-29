import mongomock
import pytest
import importlib
from datetime import datetime, timezone
from fastapi import BackgroundTasks
from fastapi import HTTPException

from modules.identity.domain.models import User
from modules.identity.domain.models import Tenant
from modules.requisition.domain.models import CompanyProfile, Requisition
from modules.shared.db import Session
from modules.hiring_manager_agent import agent as hm_agent
import main as app_main

shared_db_module = importlib.import_module("modules.shared.db")


def test_legacy_company_requires_director_approval_by_default(monkeypatch):
    database = mongomock.MongoClient()["company_flow_default"]
    monkeypatch.setattr(app_main, "get_session", lambda: Session(database))
    assert app_main._director_approval_required("missing-profile") is True
    with Session(database) as session:
        session.add(CompanyProfile(tenant_id="legacy", name="Legacy Co"))
        session.commit()
    assert app_main._director_approval_required("legacy") is True


def test_latest_company_profile_is_used_when_legacy_duplicates_exist(monkeypatch):
    database = mongomock.MongoClient()["company_flow_duplicate_profiles"]
    factory = lambda: Session(database)
    monkeypatch.setattr(app_main, "get_session", factory)
    with factory() as session:
        session.add(CompanyProfile(
            tenant_id="tenant-duplicates", name="Old profile",
            require_director_approval=True,
            created_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
        ))
        session.add(CompanyProfile(
            tenant_id="tenant-duplicates", name="Current profile",
            require_director_approval=False,
            created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        ))
        session.commit()

    assert app_main._director_approval_required("tenant-duplicates") is False
    identity_router = importlib.import_module("modules.identity.router")
    with factory() as session:
        selected = identity_router._get_company_profile("tenant-duplicates", session)
        assert selected.name == "Current profile"
        assert selected.require_director_approval is False
        assert app_main._company_dict(selected)["require_director_approval"] is False


def test_flow_toggle_endpoint_persists_false(monkeypatch):
    database = mongomock.MongoClient()["company_flow_toggle_endpoint"]
    client = database.client
    factory = lambda: Session(database)
    identity_router = importlib.import_module("modules.identity.router")
    monkeypatch.setattr(shared_db_module, "_get_client", lambda *_args, **_kwargs: client)
    with factory() as session:
        session.add(Tenant(id="tenant-toggle", name="Toggle Co"))
        session.add(User(
            id="admin-toggle", tenant_id="tenant-toggle", role="Admin",
            email="admin@example.com", name="Admin",
        ))
        session.add(CompanyProfile(
            tenant_id="tenant-toggle", name="Toggle Co", require_director_approval=True,
        ))
        session.commit()

    admin = User(
        id="admin-toggle", tenant_id="tenant-toggle", role="Admin",
        email="admin@example.com", name="Admin",
    )
    response = identity_router.update_company_flow_setting(
        identity_router.CompanyProfileUpdate(require_director_approval=False),
        admin,
        factory(),
    )
    assert response["require_director_approval"] is False
    with factory() as session:
        profile = identity_router._get_company_profile("tenant-toggle", session)
        assert profile.require_director_approval is False

    # The settings UI uses the established profile PUT endpoint so a running
    # backend does not need the dedicated flow-setting route to be present.
    with factory() as session:
        updated = identity_router.update_company_profile(
            identity_router.CompanyProfileUpdate(require_director_approval=True),
            admin,
            session,
        )
        assert updated.require_director_approval is True
    with factory() as session:
        updated = identity_router.update_company_profile(
            identity_router.CompanyProfileUpdate(require_director_approval=False),
            admin,
            session,
        )
        assert updated.require_director_approval is False
        assert identity_router.get_company_profile(admin, session).require_director_approval is False


def test_hiring_manager_chat_draft_uses_current_company_flow_policy(monkeypatch):
    client = mongomock.MongoClient()
    database = client["company_flow_chat_draft"]
    factory = lambda: Session(database)
    monkeypatch.setattr(shared_db_module, "_get_client", lambda *_args, **_kwargs: client)
    monkeypatch.setattr(shared_db_module, "get_session", factory)
    with factory() as session:
        session.add(Tenant(id="tenant-chat-flow", name="Chat Co"))
        session.add(CompanyProfile(
            tenant_id="tenant-chat-flow", name="Chat Co", require_director_approval=False,
        ))
        session.commit()

    agent_router = importlib.import_module("modules.hiring_manager_agent.router")
    monkeypatch.setattr(agent_router, "model_available", lambda: True)
    monkeypatch.setattr(agent_router, "run_hiring_manager_agent_chat", lambda **_kwargs: {
        "reply": "Send this requisition to the Director for approval.",
        "executed_actions": [{"tool": "draft_hiring_requisition", "result": {"title": "Engineer"}}],
    })
    calendar_service = importlib.import_module("modules.calendar.services.google_calendar")
    monkeypatch.setattr(calendar_service, "connection_status", lambda _user: {})
    manager = User(
        id="hm-chat-flow", tenant_id="tenant-chat-flow", role="Hiring Manager",
        name="Manager", email="manager@example.com",
    )
    response = agent_router.hiring_manager_agent_chat(
        agent_router.HiringManagerChatRequest(prompt="draft an engineer requisition"),
        manager,
    )

    assert response["executed_actions"][0]["result"]["require_director_approval"] is False
    assert "Director approval is disabled" in response["reply"]


def test_hiring_manager_flow_settings_endpoint_returns_latest_policy(monkeypatch):
    database = mongomock.MongoClient()["company_flow_settings_endpoint"]
    factory = lambda: Session(database)
    monkeypatch.setattr(shared_db_module, "get_session", factory)
    with factory() as session:
        session.add(CompanyProfile(
            tenant_id="tenant-flow-endpoint", name="Flow Co",
            require_director_approval=False,
        ))
        session.commit()

    agent_router = importlib.import_module("modules.hiring_manager_agent.router")
    manager = User(
        id="hm-flow-endpoint", tenant_id="tenant-flow-endpoint",
        role="Hiring Manager", name="Manager",
    )
    response = agent_router.get_hiring_manager_flow_settings(manager)
    assert response["require_director_approval"] is False


def test_company_can_publish_without_director_when_setting_is_disabled(monkeypatch):
    database = mongomock.MongoClient()["company_flow_direct_publish"]
    factory = lambda: Session(database)
    monkeypatch.setattr(app_main, "get_session", factory)
    monkeypatch.setattr(app_main, "notify_requisition_published", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(app_main, "_async_trigger_top_candidate_outreach", lambda *_args, **_kwargs: None)
    from modules.requisition.services.requisition_service import RequisitionService
    monkeypatch.setattr(app_main, "service", RequisitionService(session_factory=factory))

    with factory() as session:
        profile = CompanyProfile(tenant_id="tenant-1", name="Example Co", require_director_approval=False)
        session.add(profile)
        req = Requisition(
            id="req-1", tenant_id="tenant-1", company_profile_id=profile.id,
            status="PendingApproval", title="Engineer", structured_role={"title": "Engineer"},
            director_approved=False,
        )
        session.add(req)
        session.commit()

    manager = User(id="hm-1", tenant_id="tenant-1", role="Hiring Manager", name="Manager")
    result = app_main.submit_requisition_for_director_approval_route(
        "req-1", BackgroundTasks(), manager
    )
    assert result["status"] == "Published"
    assert result["director_approved"] is False
    assert app_main._get_requisition("req-1").status == "Published"


def test_new_hiring_manager_requisition_is_published_when_approval_toggle_is_off(monkeypatch):
    client = mongomock.MongoClient()
    database = client["company_flow_create_direct"]
    factory = lambda: Session(database)
    monkeypatch.setattr(app_main, "get_session", factory)
    monkeypatch.setattr(shared_db_module, "_get_client", lambda *_args, **_kwargs: client)
    monkeypatch.setattr(app_main, "notify_requisition_published", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(app_main, "_async_trigger_top_candidate_outreach", lambda *_args, **_kwargs: None)
    from modules.requisition.services.requisition_service import RequisitionService
    monkeypatch.setattr(app_main, "service", RequisitionService(session_factory=factory))

    with factory() as session:
        profile = CompanyProfile(
            tenant_id="tenant-create-direct", name="Direct Co", require_director_approval=False
        )
        session.add(profile)
        session.commit()

    manager = User(
        id="hm-create-direct", tenant_id="tenant-create-direct",
        role="Hiring Manager", name="Manager",
    )
    result = app_main.create_requisition(
        app_main.RequisitionIn(
            title="Engineer", description="Build systems",
            client_request_id="ai-card-unique-1",
        ),
        BackgroundTasks(),
        manager,
    )

    assert result["status"] == "Published"
    assert result["require_director_approval"] is False
    assert result["director_approved"] is False
    assert app_main._get_requisition(result["id"]).status == "Published"
    assert database["notifications"].count_documents({"type": "requisition_approval_request"}) == 0

    retry = app_main.create_requisition(
        app_main.RequisitionIn(
            title="Engineer", description="Build systems",
            client_request_id="ai-card-unique-1",
        ),
        BackgroundTasks(),
        manager,
    )
    assert retry["id"] == result["id"]
    assert database["requisitions"].count_documents({"client_request_id": "ai-card-unique-1"}) == 1


def test_incomplete_chat_inline_requisition_cannot_be_submitted():
    manager = User(id="hm-incomplete", tenant_id="tenant-incomplete", role="Hiring Manager", name="Manager")
    body = app_main.RequisitionIn(
        title="Forward Deployed Engineer",
        intake_mode="chat_inline",
        prefill={
            "department": "Engineering",
            "primary_location": "Remote",
            "experience_band": "Mid (2-5 yrs)",
            "work_mode": "To be confirmed",
            "start_date": "To be confirmed",
            "must_have_skills": ["To be confirmed"],
        },
    )

    with pytest.raises(HTTPException) as error:
        app_main.create_requisition(body, BackgroundTasks(), manager)

    assert error.value.status_code == 422
    assert "Hiring model" in error.value.detail
    assert "Target start date" in error.value.detail
    assert "Required skills" in error.value.detail


def test_company_flow_toggle_keeps_director_approval_gate_enabled_by_default(monkeypatch):
    database = mongomock.MongoClient()["company_flow_gate"]
    factory = lambda: Session(database)
    monkeypatch.setattr(app_main, "get_session", factory)
    from modules.requisition.services.requisition_service import RequisitionService
    monkeypatch.setattr(app_main, "service", RequisitionService(session_factory=factory))

    with factory() as session:
        profile = CompanyProfile(tenant_id="tenant-2", name="Approval Co")
        session.add(profile)
        session.add(Requisition(
            id="req-2", tenant_id="tenant-2", company_profile_id=profile.id,
            status="PendingApproval", title="Engineer", structured_role={"title": "Engineer"},
            director_approved=False,
        ))
        session.commit()

    manager = User(id="hm-2", tenant_id="tenant-2", role="Hiring Manager", name="Manager")
    with pytest.raises(Exception) as exc:
        app_main.publish_requisition("req-2", current_user=manager)
    assert getattr(exc.value, "status_code", None) == 400


def test_hiring_manager_ai_context_reads_tenant_flow_policy(monkeypatch):
    class Collection:
        def __init__(self, doc):
            self.doc = doc

        def find_one(self, _query, **_kwargs):
            return self.doc

    class Database:
        def __getitem__(self, name):
            docs = {
                "tenants": {"id": "tenant-ai", "name": "AI Co"},
                "company_profiles": {"tenant_id": "tenant-ai", "require_director_approval": False},
                "users": {"name": "Director", "email": "director@example.com"},
            }
            return Collection(docs.get(name))

    monkeypatch.setattr(hm_agent, "db", Database())
    context = hm_agent._get_tenant_company_context("tenant-ai")
    assert context["company_name"] == "AI Co"
    assert context["require_director_approval"] is False
    guide = hm_agent.get_hiring_manager_guide(require_director_approval=False)
    assert "publish finalized requisitions directly" in guide["markdown"]
    assert "Mandatory Director Approval" not in guide["markdown"]
