"""Application service for the requisition module.

Orchestrates the requisition lifecycle around the Job Requirement Agent:

    create -> start_intake -> answer*(until approval) -> approve/reject
           -> publish -> close

The service owns persistence of answers/state between agent runs and converts
agent interrupts into user-facing checkpoints. All status changes go through
the StateMachine so invalid transitions are rejected.
"""
from typing import Any

from ...shared.db import _utcnow, get_session
from .. import events
from ..agent.graph import JobRequirementAgent
from ..domain import models
from ..domain.schemas import (
    RequisitionStatus,
    RoleIntent,
    StructuredRole,
    rate_card_variance,
)
from ..domain.state import StateMachine
from ..llm.base import LLMClient
from ..llm.mock import MockLLM


def _present(value: Any) -> bool:
    return value not in (None, "", [], {})


def _num(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _seniority_from_experience(text: str) -> str:
    import re

    m = re.search(r"(\d{1,2}(?:\.\d+)?)", text or "")
    if not m:
        return "Mid"
    years = int(float(m.group(1)))
    if years >= 9:
        return "Principal"
    if years >= 7:
        return "Lead"
    if years >= 4:
        return "Senior"
    if years >= 2:
        return "Mid"
    return "Junior"


def _structured_role_from_prefill(intent: RoleIntent, prefill: dict | None) -> dict | None:
    """Persist the requisition form as a StructuredRole immediately.

    The agent may later enrich/regenerate the JD, but vendor/internal portals
    should not have to wait for the LLM before the submitted fields exist in DB.
    """
    if not prefill:
        return None

    title = (prefill.get("job_title") or intent.title or "").strip()
    if not title:
        return None

    min_rate = _num(prefill.get("range_vendors_see_min"))
    max_rate = _num(prefill.get("range_vendors_see_max"))
    vendor_range = (min_rate, max_rate) if min_rate is not None and max_rate is not None else None
    locations = prefill.get("work_locations") or []
    seniority = prefill.get("seniority") or _seniority_from_experience(str(prefill.get("experience") or ""))

    role = StructuredRole(
        title=title,
        must_have_skills=prefill.get("must_have_skills") or [],
        nice_to_have_skills=prefill.get("nice_to_have_skills") or [],
        seniority=seniority,
        location=locations[0] if locations else "",
        rate_band=vendor_range,
        contract_duration=prefill.get("duration") or "",
        confidence=0.75,
        notes="Saved from structured requisition form.",
        job_family=prefill.get("job_family") or "",
        certifications=prefill.get("certifications") or [],
        headcount=_num(prefill.get("headcount")) or 1,
        experience=prefill.get("experience") or "",
        engagement_type=prefill.get("engagement_type") or "",
        duration=prefill.get("duration") or "",
        start_date=prefill.get("start_date") or "",
        ends_on=prefill.get("ends_on") or "",
        extension_likely=bool(prefill.get("extension_likely")),
        max_notice_period=prefill.get("max_notice_period") or "",
        ceiling_internal=_num(prefill.get("ceiling_internal")),
        range_vendors_see=vendor_range,
        rate_card_cap=_num(prefill.get("rate_card_cap")),
        total_engagement_value=prefill.get("total_engagement_value") or "",
        cost_centre=prefill.get("cost_centre") or "",
        budget_approved=bool(prefill.get("budget_approved")),
        budget_reference=prefill.get("budget_reference") or "",
        variance_approved=bool(prefill.get("variance_approved")),
        work_mode=prefill.get("work_mode") or "",
        work_locations=locations,
        working_hours=prefill.get("working_hours") or "",
        location_remote_policy=prefill.get("location_remote_policy") or "",
        onsite_requirement=prefill.get("onsite_requirement") or "",
        equipment_provisioning=prefill.get("equipment_provisioning") or "",
        background_check=prefill.get("background_check") or "",
        background_check_required=bool(prefill.get("background_check_required")),
        nda_contract_type=prefill.get("nda_contract_type") or "",
        work_authorization=prefill.get("work_authorization") or "",
        client_site_access=bool(prefill.get("client_site_access")),
        security_clearance_required=bool(prefill.get("security_clearance_required")),
        security_clearance_notes=prefill.get("security_clearance_notes") or "",
        hiring_manager=prefill.get("hiring_manager") or "",
        submission_deadline=prefill.get("submission_deadline") or "",
        priority=prefill.get("priority") or "Normal",
    )
    return role.model_dump()


class RequisitionService:
    def __init__(self, llm: LLMClient | None = None, session_factory=None, checkpointer=None) -> None:
        self.session_factory = session_factory or get_session
        self.llm = llm or MockLLM()
        self.checkpointer = checkpointer
        self._agent: JobRequirementAgent | None = None

    @property
    def agent(self) -> JobRequirementAgent:
        if self._agent is None:
            self._agent = JobRequirementAgent(
                self.llm, self.session_factory, checkpointer=self.checkpointer
            )
        return self._agent

    # --- lifecycle ---

    def create(
        self,
        company_profile_id: str,
        intent: RoleIntent,
        created_by: str | None = None,
        tenant_id: str = "local",
        intake_meta: dict | None = None,
    ) -> models.Requisition:
        prefill = dict((intake_meta or {}).get("prefill") or {})
        saved_role = _structured_role_from_prefill(intent, prefill)
        with self.session_factory() as session:
            req = models.Requisition(
                tenant_id=tenant_id,
                company_profile_id=company_profile_id,
                created_by=created_by,
                status=RequisitionStatus.DRAFT.value,
                title=intent.title,
                intent=intent.model_dump(),
                intake_meta=intake_meta or {},
                structured_role=saved_role,
            )
            session.add(req)
            session.commit()
            session.refresh(req)
        events.emit_requisition_created(req.id, tenant_id)
        return req

    def _transition(self, session, requisition_id: str, to: RequisitionStatus) -> None:
        req = session.get(models.Requisition, requisition_id)
        sm = StateMachine(RequisitionStatus(req.status))
        sm.transition(to)
        req.status = sm.status.value

    def start_intake(self, requisition_id: str) -> tuple[dict, Any]:
        with self.session_factory() as session:
            self._transition(session, requisition_id, RequisitionStatus.INTAKE)
            session.commit()
        events.emit_intake_started(requisition_id)
        return self._step(requisition_id)

    def answer(self, requisition_id: str, answer: str) -> tuple[dict, Any]:
        """Resume the intake interrupt with the manager's free-text answer."""
        return self._step(requisition_id, resume=answer)

    def approve(
        self,
        requisition_id: str,
        reviewer: str | None = None,
        edited_role: StructuredRole | None = None,
    ) -> tuple[dict, Any]:
        """Approve the generated role (optionally with human edits)."""
        resume = {"decision": "approved"}
        if edited_role is not None:
            resume["edited_role"] = edited_role.model_dump()
        state, interrupt_value = self._step(requisition_id, resume=resume)
        self._record_review(requisition_id, reviewer, "approved")
        return state, interrupt_value

    def refine(self, requisition_id: str, instruction: str) -> tuple[dict, Any]:
        """Send edit feedback for the generated JD.

        The agent incorporates the instruction, re-generates the role + JD and
        returns to the approval checkpoint with the updated output.
        """
        instruction = instruction.strip()
        if not instruction:
            raise ValueError("refinement instruction cannot be empty")
        with self.session_factory() as session:
            req = session.get(models.Requisition, requisition_id)
            if req.status != RequisitionStatus.STRUCTURING.value:
                raise ValueError(
                    f"refinement requires a generated JD awaiting approval; status is {req.status}"
                )
        return self._step(requisition_id, resume={"instruction": instruction})

    def reject(self, requisition_id: str, reviewer: str | None = None) -> tuple[dict, Any]:
        state, interrupt_value = self._step(requisition_id, resume={"decision": "rejected"})
        self._record_review(requisition_id, reviewer, "rejected")
        return state, interrupt_value

    def publish(self, requisition_id: str, by: str | None = None) -> models.Requisition:
        with self.session_factory() as session:
            req = session.get(models.Requisition, requisition_id)
            if rate_card_variance(req.structured_role):
                raise ValueError(
                    "Your ceiling is above the agreed rate card. HR must approve "
                    "the variance before this requisition can be published."
                )
            sm = StateMachine(RequisitionStatus(req.status))
            sm.transition(RequisitionStatus.PUBLISHED)
            req.status = sm.status.value
            req.approved_by = by
            req.approved_at = _utcnow()
            role = req.structured_role
            session.commit()
        events.emit_requisition_published(requisition_id, structured_role=role)
        return req

    def close(self, requisition_id: str) -> models.Requisition:
        with self.session_factory() as session:
            req = session.get(models.Requisition, requisition_id)
            sm = StateMachine(RequisitionStatus(req.status))
            sm.transition(RequisitionStatus.CLOSED)
            req.status = sm.status.value
            session.commit()
        events.emit_requisition_closed(requisition_id)
        return req

    def reset(self, requisition_id: str) -> models.Requisition:
        """Reset a requisition to Draft, clearing agent artifacts.

        Drops the cached agent too so the in-memory checkpointer forgets the
        thread and a fresh ``start_intake`` re-runs coverage + generation.
        """
        with self.session_factory() as session:
            req = session.get(models.Requisition, requisition_id)
            if req.status != RequisitionStatus.DRAFT.value:
                sm = StateMachine(RequisitionStatus(req.status))
                sm.transition(RequisitionStatus.DRAFT)
                req.status = sm.status.value
            req.intake_answers = []
            req.structured_role = None
            req.generated_jd_markdown = None
            req.coverage_result = None
            req.refinement_log = []
            req.pending_question = None
            session.commit()
            session.refresh(req)
        self._agent = None
        return req

    def delete(self, requisition_id: str) -> None:
        """Permanently delete a requisition and its decision records."""
        with self.session_factory() as session:
            session.query(models.DecisionRecord).filter_by(
                requisition_id=requisition_id
            ).delete(synchronize_session=False)
            req = session.get(models.Requisition, requisition_id)
            if req is None:
                raise ValueError(f"requisition {requisition_id} not found")
            session.delete(req)
            session.commit()
        self._agent = None

    # --- internals ---

    def _step(self, requisition_id: str, resume: Any = None) -> tuple[dict, Any]:
        state, interrupt_value = self.agent.run(requisition_id, resume=resume)
        self._persist_state(requisition_id, state, interrupt_value)
        return state, interrupt_value

    def _persist_state(self, requisition_id: str, state: dict, interrupt_value: Any = None) -> None:
        with self.session_factory() as session:
            req = session.get(models.Requisition, requisition_id)
            req.intake_answers = state.get("answers") or req.intake_answers
            if state.get("status"):
                req.status = state["status"]
            # The pending intake question is the string interrupt; approval is a dict.
            if state.get("status") == RequisitionStatus.INTAKE.value and isinstance(interrupt_value, str):
                req.pending_question = interrupt_value
            else:
                req.pending_question = None
            if state.get("covered") is not None:
                req.coverage_result = {
                    "covered": bool(state["covered"]),
                    "missing_skills": state.get("missing_skills") or [],
                }
            if state.get("structured_role"):
                req.structured_role = state["structured_role"]
            if state.get("jd_markdown"):
                req.generated_jd_markdown = state["jd_markdown"]
            session.commit()

    def _record_review(self, requisition_id: str, reviewer: str | None, decision: str) -> None:
        with self.session_factory() as session:
            record = (
                session.query(models.DecisionRecord)
                .filter_by(requisition_id=requisition_id)
                .order_by(models.DecisionRecord.created_at.desc())
                .first()
            )
            if record:
                record.reviewed_by = reviewer
                record.reviewed_at = _utcnow()
                record.decision = decision
                session.commit()
