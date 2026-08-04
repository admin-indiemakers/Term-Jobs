"""SQLAlchemy models for the requisition module."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...shared.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), default="local", index=True)
    name: Mapped[str] = mapped_column(String(255))
    industry: Mapped[str] = mapped_column(String(255), default="")
    size: Mapped[str] = mapped_column(String(100), default="")
    location: Mapped[str] = mapped_column(String(255), default="")
    tech_stack: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Requisition(Base):
    __tablename__ = "requisitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), default="local", index=True)
    company_profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("company_profiles.id"), nullable=True
    )
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # state machine
    status: Mapped[str] = mapped_column(String(30), default="Draft")

    # input
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    intent: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    intake_answers: Mapped[list] = mapped_column(JSON, default=list)

    # agent output (candidate, awaiting human approval)
    structured_role: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    generated_jd_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    coverage_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # approval
    approved_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DecisionRecord(Base):
    __tablename__ = "decision_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    requisition_id: Mapped[str] = mapped_column(
        ForeignKey("requisitions.id"), index=True
    )
    agent_name: Mapped[str] = mapped_column(String(100))
    input_context: Mapped[dict] = mapped_column(JSON, default=dict)
    output: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    guardrail_status: Mapped[str] = mapped_column(String(20), default="pending")  # passed | blocked
    reviewed_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision: Mapped[str | None] = mapped_column(String(20), nullable=True)  # approved | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())