"""Coverage check + intake-loop behaviour driven through the full service flow."""
from modules.requisition.domain.schemas import RoleIntent
from modules.requisition.enrichment.skills import is_covered


def test_is_covered_direct():
    ok, missing = is_covered(["Python", "Django"], ["Python", "Django", "Postgres"])
    assert ok and missing == []
    ok, missing = is_covered(["Go", "Kubernetes"], ["Python", "Django"])
    assert not ok and set(missing) == {"go", "kubernetes"}


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


def test_uncovered_stack_asks_for_stack(service, company_profile):
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

    _, interrupt = service.answer(req.id, "Go, Kubernetes, Terraform")
    assert isinstance(interrupt, str)  # seniority asked next
    assert "seniority" in interrupt.lower()