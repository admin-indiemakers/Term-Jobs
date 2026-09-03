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
    """What the hiring manager asked for when starting a hire.

    ``prompt`` is the free-form "direct prompt" mode: when set, the agent
    parses the whole role from this single paragraph instead of running the
    one-question-at-a-time intake conversation.
    """
    title: str
    description: str = ""
    tech_stack_hint: list[str] = Field(default_factory=list)
    prompt: str = ""


class StructuredRole(BaseModel):
    """AI-drafted role that the hiring manager reviews and edits across the
    tabbed editor (Role / Engagement / Commercials / Work setup / Compliance /
    Process). Only ``title`` and ``seniority`` are strictly required; every
    additional field is optional so the schema stays backwards-compatible with
    drafts that predate the tabbed editor.
    """
    title: str
    must_have_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    seniority: Seniority
    location: str = ""
    rate_band: tuple[int, int] | None = None  # (min, max) INR per annum
    contract_duration: str = ""  # e.g. "6 months", "1 year", "Permanent"
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    notes: str = ""

    # Role tab
    job_family: str = ""
    certifications: list[str] = Field(default_factory=list)
    headcount: int = Field(default=1, ge=1)
    vendor_candidate_limit: int = Field(default=1, ge=1)
    experience: str = ""  # e.g. "5-8 years" (free text, distinct from seniority level)

    # Engagement tab
    engagement_type: str = ""  # e.g. "Contract", "Permanent", "Freelance"
    duration: str = ""  # e.g. "6 months"
    start_date: str = ""
    ends_on: str = ""
    extension_likely: bool = False
    max_notice_period: str = ""  # e.g. "30 days"

    # Commercials tab
    ceiling_internal: int | None = None  # max budget the company will pay (INR p.a.)
    range_vendors_see: tuple[int, int] | None = None  # (min, max) INR p.a.
    rate_card_cap: int | None = None  # agreed rate-card cap (INR p.a.) for variance checks
    total_engagement_value: str = ""
    cost_centre: str = ""
    budget_approved: bool = False  # approval boolean (displayed as "Yes · PO <ref>")
    budget_reference: str = ""  # PO / reference number shown next to the approval
    variance_approved: bool = False  # HR approval recorded for a rate-card variance

    # Work setup tab
    work_mode: str = ""  # Remote / Hybrid / Onsite
    work_locations: list[str] = Field(default_factory=list)  # cities/regions
    working_hours: str = ""  # e.g. "IST business hours"
    location_remote_policy: str = ""
    onsite_requirement: str = ""
    equipment_provisioning: str = ""  # Company-provided / Vendor-provided / BYOD

    # Compliance tab
    background_check: str = ""
    background_check_required: bool = False
    nda_contract_type: str = ""  # Consultancy agreement / NDA-only / MSA-linked
    work_authorization: str = ""
    client_site_access: bool = False  # whether role requires on-site access at client premises
    security_clearance_required: bool = False
    security_clearance_notes: str = ""

    # Process tab
    hiring_manager: str = ""
    submission_deadline: str = ""
    priority: str = "Normal"  # High / Normal / Low (displayed as text, not badge)

    @field_validator("rate_band")
    @classmethod
    def _validate_rate_band(cls, v: tuple[int, int] | None) -> tuple[int, int] | None:
        if v is not None and v[0] > v[1]:
            raise ValueError("rate_band min cannot exceed max")
        return v

    @field_validator("range_vendors_see")
    @classmethod
    def _validate_range_vendors_see(cls, v: tuple[int, int] | None) -> tuple[int, int] | None:
        if v is not None and v[0] > v[1]:
            raise ValueError("range_vendors_see min cannot exceed max")
        return v


def rate_card_variance(role: "StructuredRole | dict | None") -> bool:
    """True when the internal ceiling exceeds the agreed rate-card cap.

    This is the system-generated variance signal: it is never a free-text
    field, and publish is blocked until ``variance_approved`` is set.
    """
    if role is None:
        return False
    if isinstance(role, dict):
        ceiling = role.get("ceiling_internal")
        cap = role.get("rate_card_cap")
        approved = role.get("variance_approved")
    else:
        ceiling = role.ceiling_internal
        cap = role.rate_card_cap
        approved = role.variance_approved
    if approved:
        return False
    return bool(ceiling is not None and cap is not None and ceiling > cap)


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