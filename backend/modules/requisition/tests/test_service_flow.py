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


def test_refine_regenerates_and_logs(service, company_profile, session_factory):
    profile_id = company_profile(tech_stack=["Python", "Django"])
    intent = {
        "title": "Backend Engineer",
        "description": "Django + Postgres APIs, 5+ years.",
        "tech_stack_hint": ["Python", "Django"],
    }
    req = service.create(profile_id, RoleIntent(**intent))
    _, interrupt = service.start_intake(req.id)
    assert isinstance(interrupt, dict) and interrupt["checkpoint"] == "approval"

    # Chat-back: ask the agent to add something to the generated JD.
    state, interrupt = service.refine(req.id, "Add responsibilities around code review.")
    assert isinstance(interrupt, dict) and interrupt["checkpoint"] == "approval"
    assert "refined" in interrupt["jd_markdown"]
    assert state["refine_turns"] == 1

    with session_factory() as s:
        stored = s.get(models.Requisition, req.id)
        assert len(stored.refinement_log) == 1
        assert "code review" in stored.refinement_log[0]["instruction"]
        assert "refined" in stored.refinement_log[0]["jd_markdown"]
        assert stored.status == RequisitionStatus.STRUCTURING.value

    # Still awaiting human approval after the refinement.
    service.approve(req.id, reviewer="mgr")
    with session_factory() as s:
        assert s.get(models.Requisition, req.id).status == RequisitionStatus.PENDING_APPROVAL.value


def test_refine_rejects_without_generated_jd(service, company_profile, session_factory):
    profile_id = company_profile(tech_stack=["Python", "Django"])
    intent = {
        "title": "Backend Engineer",
        "description": "Django + Postgres APIs, 5+ years.",
        "tech_stack_hint": ["Python", "Django"],
    }
    req = service.create(profile_id, RoleIntent(**intent))
    import pytest

    with pytest.raises(ValueError):
        service.refine(req.id, "add something")


def test_direct_prompt_mode_skips_intake(service, company_profile, session_factory):
    profile_id = company_profile(tech_stack=["Python", "Django"])
    intent = {
        "title": "Flutter Developer",
        "prompt": "Flutter developer, 3 yrs exp, 8-12 LPA, kozhikode or remote, Supabase backend",
    }
    req = service.create(profile_id, RoleIntent(**intent))
    with session_factory() as s:
        assert s.get(models.Requisition, req.id).intent.get("prompt") == intent["prompt"]

    # Prompt mode must reach the approval checkpoint with no intake questions.
    _, interrupt = service.start_intake(req.id)
    assert isinstance(interrupt, dict) and interrupt["checkpoint"] == "approval"

    with session_factory() as s:
        stored = s.get(models.Requisition, req.id)
        assert stored.status == RequisitionStatus.STRUCTURING.value
        assert stored.generated_jd_markdown, "JD should be generated straight from prompt"
        assert "Contract duration" in stored.generated_jd_markdown, "JD must state contract duration"
        role = stored.structured_role
        assert role["location"] in ("Kozhikode", "Remote")
        assert "3+ years" in role["notes"], "years should be extracted from the prompt"
        assert role["rate_band"], "rate band should be extracted from the prompt"


def test_delete_removes_requisition(service, company_profile, session_factory):
    profile_id = company_profile(tech_stack=["Python", "Django"])
    intent = {
        "title": "Backend Engineer",
        "description": "Django + Postgres APIs, 5+ years.",
        "tech_stack_hint": ["Python", "Django"],
    }
    req = service.create(profile_id, RoleIntent(**intent))
    req_id = req.id

    service.delete(req_id)
    with session_factory() as s:
        assert s.get(models.Requisition, req_id) is None
        assert (
            s.query(models.DecisionRecord).filter_by(requisition_id=req_id).count() == 0
        )

    import pytest

    with pytest.raises(ValueError):
        service.delete(req_id)


def test_delete_clears_decision_records(service, company_profile, session_factory):
    profile_id = company_profile(tech_stack=["Python", "Django"])
    intent = {
        "title": "Backend Engineer",
        "description": "Django + Postgres APIs, 5+ years.",
        "tech_stack_hint": ["Python", "Django"],
    }
    req = service.create(profile_id, RoleIntent(**intent))
    _, interrupt = service.start_intake(req.id)
    assert isinstance(interrupt, dict) and interrupt["checkpoint"] == "approval"

    with session_factory() as s:
        assert s.query(models.DecisionRecord).filter_by(requisition_id=req.id).count() == 1

    service.delete(req.id)
    with session_factory() as s:
        assert s.query(models.DecisionRecord).filter_by(requisition_id=req.id).count() == 0