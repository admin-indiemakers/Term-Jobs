"""Guardrail layer for the Job Requirement Agent.

Every agent run passes through: budget gate (LLM calls / intake turns),
pydantic schema validation, a confidence check, and a reversibility check.
Nothing ever auto-publishes — human approval is structurally enforced by the
approval checkpoint in the graph.
"""
from ...shared.config import settings
from ..domain.schemas import StructuredRole


class GuardrailError(Exception):
    pass


class BudgetExceeded(GuardrailError):
    pass


class ConfidenceBlocked(GuardrailError):
    pass


def enforce_budget(intake_turns: int, tool_calls: int) -> None:
    if intake_turns > settings.max_intake_turns:
        raise BudgetExceeded(
            f"intake turns {intake_turns} exceed budget {settings.max_intake_turns}"
        )
    if tool_calls > settings.max_tool_calls:
        raise BudgetExceeded(f"tool calls {tool_calls} exceed budget {settings.max_tool_calls}")


def validate_role(data: dict) -> StructuredRole:
    """Pydantic schema validation; raises GuardrailError on failure."""
    try:
        return StructuredRole.model_validate(data)
    except Exception as exc:  # pydantic.ValidationError
        raise GuardrailError(f"structured role failed schema validation: {exc}") from exc


def confidence_gate(role: StructuredRole) -> str:
    """Return 'passed' or 'blocked' based on the configured threshold."""
    if role.confidence >= settings.confidence_threshold:
        return "passed"
    return "blocked"


def reversibility_ok(needs_approval: bool = True) -> bool:
    """Human review makes agent output fully reversible. Never auto-execute."""
    return needs_approval