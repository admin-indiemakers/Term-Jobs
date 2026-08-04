import pytest
from pydantic import ValidationError

from modules.requisition.agent.guardrails import (
    BudgetExceeded,
    GuardrailError,
    confidence_gate,
    enforce_budget,
    validate_role,
)
from modules.requisition.domain.schemas import Seniority, StructuredRole


def test_valid_structured_role():
    role = validate_role(
        {
            "title": "Backend Engineer",
            "must_have_skills": ["python", "django"],
            "seniority": "Senior",
            "location": "Bangalore",
            "rate_band": [2_500_000, 3_000_000],
            "confidence": 0.9,
        }
    )
    assert role.title == "Backend Engineer"


def test_invalid_role_rejected():
    with pytest.raises(GuardrailError):
        validate_role({"title": "", "must_have_skills": [], "seniority": "Mid", "confidence": 1.5})


def test_rate_band_min_max_validation():
    with pytest.raises(ValidationError):
        StructuredRole(
            title="x", seniority=Seniority.MID, rate_band=(5_000_000, 2_000_000)
        )


def test_confidence_gate_threshold():
    role = StructuredRole(title="x", seniority=Seniority.MID, confidence=0.8)
    assert confidence_gate(role) == "passed"
    role_low = StructuredRole(title="x", seniority=Seniority.MID, confidence=0.4)
    assert confidence_gate(role_low) == "blocked"


def test_budget_enforced():
    with pytest.raises(BudgetExceeded):
        enforce_budget(intake_turns=100, tool_calls=0)
    with pytest.raises(BudgetExceeded):
        enforce_budget(intake_turns=0, tool_calls=100)
    enforce_budget(intake_turns=1, tool_calls=1)  # no raise