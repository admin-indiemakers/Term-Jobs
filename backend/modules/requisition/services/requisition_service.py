"""Application service for the requisition module.

Orchestrates the requisition lifecycle around the Job Requirement Agent:

    create -> start_intake -> answer*(until approval) -> approve/reject
           -> publish -> close

The service owns persistence of answers/state between agent runs and converts
agent interrupts into user-facing checkpoints. All status changes go through
the StateMachine so invalid transitions are rejected.
"""
from typing import Any

from sqlalchemy import func

from ...shared.db import get_session
from .. import events
from ..agent.graph import JobRequirementAgent
from ..domain import models
from ..domain.schemas import (
    RequisitionStatus,
    RoleIntent,
    StructuredRole,
)
from ..domain.state import StateMachine
from ..llm.base import LLMClient
from ..llm.mock import MockLLM


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
    ) -> models.Requisition:
        with self.session_factory() as session:
            req = models.Requisition(
                tenant_id=tenant_id,
                company_profile_id=company_profile_id,
                created_by=created_by,
                status=RequisitionStatus.DRAFT.value,
                title=intent.title,
                intent=intent.model_dump(),
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

    def reject(self, requisition_id: str, reviewer: str | None = None) -> tuple[dict, Any]:
        state, interrupt_value = self._step(requisition_id, resume={"decision": "rejected"})
        self._record_review(requisition_id, reviewer, "rejected")
        return state, interrupt_value

    def publish(self, requisition_id: str, by: str | None = None) -> models.Requisition:
        with self.session_factory() as session:
            req = session.get(models.Requisition, requisition_id)
            sm = StateMachine(RequisitionStatus(req.status))
            sm.transition(RequisitionStatus.PUBLISHED)
            req.status = sm.status.value
            req.approved_by = by
            req.approved_at = func.now()
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

    # --- internals ---

    def _step(self, requisition_id: str, resume: Any = None) -> tuple[dict, Any]:
        state, interrupt_value = self.agent.run(requisition_id, resume=resume)
        self._persist_state(requisition_id, state)
        return state, interrupt_value

    def _persist_state(self, requisition_id: str, state: dict) -> None:
        with self.session_factory() as session:
            req = session.get(models.Requisition, requisition_id)
            req.intake_answers = state.get("answers") or req.intake_answers
            if state.get("status"):
                req.status = state["status"]
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
                record.reviewed_at = func.now()
                record.decision = decision
                session.commit()