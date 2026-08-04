"""Pydantic contracts for the requisition module.

These are the source of truth for validation at every boundary: enrichment
output, LLM structured output, and the approval/edit flow.
"""
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class RequisitionStatus(str, Enum):
    DRAFT = "Draft"
    INTAKE = "Intake"
    STRUCTURING = "Structuring"
    PENDING_APPROVAL = "PendingApproval"
    PUBLISHED = "Published"
    CLOSED = "Closed"


class Seniority(str, Enum):
    JUNIOR = "Junior"
    MID = "Mid"
    SENIOR = "Senior"
    LEAD = "Lead"
    PRINCIPAL = "Principal"


class CompanyProfile(BaseModel):
    """Registered company details + tech stack. Ownership moves to identity/
    later; here it is the agent's core context."""
    name: str
    industry: str = ""
    size: str = ""
    location: str = ""
    tech_stack: list[str] = Field(default_factory=list)
    notes: str = ""


class RoleIntent(BaseModel):
    """What the hiring manager asked for when starting a hire."""
    title: str
    description: str = ""
    tech_stack_hint: list[str] = Field(default_factory=list)


class StructuredRole(BaseModel):
    title: str
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    seniority: Seniority
    location: str = ""
    rate_band: tuple[int, int] | None = None  # (min, max) INR per annum
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    notes: str = ""

    @field_validator("rate_band")
    @classmethod
    def _validate_rate_band(cls, v: tuple[int, int] | None) -> tuple[int, int] | None:
        if v is not None and v[0] > v[1]:
            raise ValueError("rate_band min cannot exceed max")
        return v


class GeneratedJD(BaseModel):
    markdown: str
    structured_role: StructuredRole


class IntakeAnswer(BaseModel):
    question_id: str
    value: str


class CoverageResult(BaseModel):
    covered: bool
    missing_skills: list[str] = Field(default_factory=list)
    reason: str = ""


class DecisionRecordOut(BaseModel):
    requisition_id: str
    agent_name: str
    output: dict
    confidence: float
    guardrail_status: str