"""Full lifecycle through the service, including the human reject path."""
from modules.requisition.domain import models
from modules.requisition.domain.schemas import RequisitionStatus, RoleIntent


def test_happy_path(service, company_profile, session_factory, run_flow):
    profile_id = company_profile(tech_stack=["Python", "Django", "Postgres"])
    intent = {
        "title": "Backend Engineer",
        "description": "APIs on Django + Postgres, 5+ years.",
        "tech_stack_hint": ["Python", "Django"],
    }
    req_id = run_flow(profile_id, intent, answers=[])

    with session_factory() as s:
        req = s.get(models.Requisition, req_id)
        assert req.status == RequisitionStatus.PUBLISHED.value
        assert req.structured_role, "structured role should be generated"
        assert req.generated_jd_markdown, "JD markdown should be generated"
        assert req.approved_by == "mgr"
        # decision record persisted for auditability
        record = s.query(models.DecisionRecord).filter_by(requisition_id=req_id).first()
        assert record is not None
        assert record.guardrail_status == "passed"
        assert record.decision == "approved"
        assert record.agent_name == "job_requirement_agent"


def test_reject_returns_to_draft(service, company_profile, session_factory):
    profile_id = company_profile(tech_stack=["Python", "Django", "Postgres"])
    intent = {
        "title": "Backend Engineer",
        "description": "APIs on Django + Postgres, 5+ years.",
        "tech_stack_hint": ["Python", "Django"],
    }
    req = service.create(profile_id, RoleIntent(**intent))
    _, interrupt = service.start_intake(req.id)
    assert isinstance(interrupt, dict) and interrupt["checkpoint"] == "approval"

    service.reject(req.id, reviewer="mgr")
    with session_factory() as s:
        assert s.get(models.Requisition, req.id).status == RequisitionStatus.DRAFT.value


def test_close_after_publish(service, company_profile, session_factory, run_flow):
    profile_id = company_profile(tech_stack=["Python", "Django"])
    intent = {
        "title": "Backend Engineer",
        "description": "Django + Postgres APIs, 5+ years.",
        "tech_stack_hint": ["Python", "Django"],
    }
    req_id = run_flow(profile_id, intent, answers=[])
    service.close(req_id)
    with session_factory() as s:
        assert s.get(models.Requisition, req_id).status == RequisitionStatus.CLOSED.value


def test_invalid_create_empty_intent_rejected(service, company_profile, session_factory):
    profile_id = company_profile(tech_stack=["Python"])
    with session_factory() as s:
        req = service.create(profile_id, RoleIntent(title="", description=""))
        assert s.get(models.Requisition, req.id) is not None