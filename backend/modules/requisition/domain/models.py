"""Requisition domain models (MongoDB collections)."""
from typing import ClassVar

from ...shared.db import Column, Model, _utcnow, _uuid


class CompanyProfile(Model):
    __tablename__ = "company_profiles"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": "local",
        "name": "",
        "industry": "",
        "size": "",
        "location": "",
        "tech_stack": list,
        "notes": "",
        "created_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    name = Column("name")
    industry = Column("industry")
    size = Column("size")
    location = Column("location")
    tech_stack = Column("tech_stack")
    notes = Column("notes")
    created_at = Column("created_at")


class Requisition(Model):
    __tablename__ = "requisitions"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": "local",
        "company_profile_id": None,
        "created_by": None,
        "status": "Draft",
        "title": None,
        "intent": None,
        "intake_answers": list,
        "pending_question": None,
        "structured_role": None,
        "generated_jd_markdown": None,
        "coverage_result": None,
        "refinement_log": list,
        "intake_meta": dict,
        "vendor_candidate_limit": 1,
        "director_approved": False,
        "director_approved_by": None,
        "director_approved_at": None,
        "rejection_reason": None,
        "rejected_by": None,
        "rejected_at": None,
        "approved_by": None,
        "approved_at": None,
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    company_profile_id = Column("company_profile_id")
    created_by = Column("created_by")
    status = Column("status")
    title = Column("title")
    intent = Column("intent")
    intake_answers = Column("intake_answers")
    pending_question = Column("pending_question")
    structured_role = Column("structured_role")
    generated_jd_markdown = Column("generated_jd_markdown")
    coverage_result = Column("coverage_result")
    refinement_log = Column("refinement_log")
    intake_meta = Column("intake_meta")
    vendor_candidate_limit = Column("vendor_candidate_limit")
    director_approved = Column("director_approved")
    director_approved_by = Column("director_approved_by")
    director_approved_at = Column("director_approved_at")
    rejection_reason = Column("rejection_reason")
    rejected_by = Column("rejected_by")
    rejected_at = Column("rejected_at")
    approved_by = Column("approved_by")
    approved_at = Column("approved_at")
    created_at = Column("created_at")
    updated_at = Column("updated_at")


class RoleTemplate(Model):
    """A director-uploaded JSON template that hiring managers can pick from to
    pre-fill the New Requisition form. ``structured_role`` holds the same field
    shape as a Requisition's structured role (all 6 tabs)."""

    __tablename__ = "role_templates"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "tenant_id": "local",
        "created_by": None,
        "name": "",
        "description": "",
        "structured_role": None,
        "created_at": _utcnow,
    }

    id = Column("id")
    tenant_id = Column("tenant_id")
    created_by = Column("created_by")
    name = Column("name")
    description = Column("description")
    structured_role = Column("structured_role")
    created_at = Column("created_at")


class DecisionRecord(Model):
    __tablename__ = "decision_records"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "requisition_id": "",
        "agent_name": "",
        "input_context": dict,
        "output": dict,
        "confidence": 0.0,
        "guardrail_status": "pending",  # passed | blocked
        "reviewed_by": None,
        "reviewed_at": None,
        "decision": None,  # approved | rejected
        "created_at": _utcnow,
    }

    id = Column("id")
    requisition_id = Column("requisition_id")
    agent_name = Column("agent_name")
    input_context = Column("input_context")
    output = Column("output")
    confidence = Column("confidence")
    guardrail_status = Column("guardrail_status")
    reviewed_by = Column("reviewed_by")
    reviewed_at = Column("reviewed_at")
    decision = Column("decision")
    created_at = Column("created_at")
