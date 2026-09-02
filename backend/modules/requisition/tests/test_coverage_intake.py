"""Coverage check + intake-loop behaviour driven through the full service flow."""
from modules.requisition.domain import models
from modules.requisition.domain.schemas import RoleIntent
from modules.requisition.enrichment.skills import canonicalize_skill, is_covered


def test_is_covered_direct():
    ok, missing = is_covered(["Python", "Django"], ["Python", "Django", "Postgres"])
    assert ok and missing == []
    ok, missing = is_covered(["Go", "Kubernetes"], ["Python", "Django"])
    assert not ok and set(missing) == {"go", "kubernetes"}


def test_canonicalize_does_not_fuzzy_match_short_skills():
    # 'flutter' must not collapse to the 1-char canonical skill 'r' just
    # because it *contains* an 'r' (regression: raw-JD fallback showed
    # Uncovered: ['r', 'superbas3e'] for a Flutter role).
    assert canonicalize_skill("flutter") == "flutter"


def test_canonicalize_handles_typos_and_leetspeak():
    assert canonicalize_skill("ython") == "python"
    assert canonicalize_skill("superbas3e") == "supabase"
    assert canonicalize_skill("j4va") == "java"
    assert canonicalize_skill("mongo d8") == "mongodb"


def test_covered_stack_skips_intake(service, company_profile):
    profile_id = company_profile(tech_stack=["Python", "Django", "Postgres"])
    intent = {
        "title": "Backend Engineer",
        "description": "Build APIs on Django and Postgres.",
        "tech_stack_hint": ["Python", "Django", "Postgres"],
    }
    req = service.create(profile_id, RoleIntent(**intent))
    state, interrupt = service.start_intake(req.id)

    # Covered -> straight to approval, no intake questions.
    assert isinstance(interrupt, dict) and interrupt["checkpoint"] == "approval"
    assert state["intake_turns"] == 0


def test_uncovered_stack_asks_for_stack(service, company_profile, session_factory):
    profile_id = company_profile(tech_stack=["Python", "Django"])
    intent = {
        "title": "Platform Engineer",
        "description": "Kubernetes platform work.",
        "tech_stack_hint": ["Go", "Kubernetes"],
    }
    req = service.create(profile_id, RoleIntent(**intent))
    _, interrupt = service.start_intake(req.id)

    # Uncovered -> first interrupt is an intake question about the stack.
    assert isinstance(interrupt, str)
    assert "tech stack" in interrupt.lower() or "skills" in interrupt.lower()

    with session_factory() as session:
        stored = session.get(models.Requisition, req.id)
        assert stored.coverage_result["covered"] is False
        assert set(stored.coverage_result["missing_skills"]) == {"go", "kubernetes"}
        # the pending question survives a reload (persisted, not in-memory)
        assert stored.pending_question and "tech stack" in stored.pending_question.lower()

    _, interrupt = service.answer(req.id, "Go, Kubernetes, Terraform")
    assert isinstance(interrupt, str)  # seniority asked next
    assert "seniority" in interrupt.lower()

    with session_factory() as session:
        assert "seniority" in (session.get(models.Requisition, req.id).pending_question or "").lower()

    # finish the remaining intake questions -> approval; pending question cleared
    for answer in ["Senior", "5 years", "Chennai", "24 lpa", "6 months"]:
        service.answer(req.id, answer)
    with session_factory() as session:
        stored = session.get(models.Requisition, req.id)
        assert stored.status == "Structuring"
        assert stored.pending_question is None
        assert "Contract duration" in stored.generated_jd_markdown