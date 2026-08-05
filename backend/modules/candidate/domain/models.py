"""SQLAlchemy models for the candidate module.

The ``candidate_submissions`` table is produced by the Candidate Screening
Agent (vendor recruiter submissions). This module reads it from the main app
so the Hiring Manager dashboard can surface shortlisted candidates.
"""
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...shared.db import Base


class CandidateSubmission(Base):
    __tablename__ = "candidate_submissions"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    requisition_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    candidate_name: Mapped[str] = mapped_column(String(255))
    candidate_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vendor_name: Mapped[str] = mapped_column(String(255), default="Vendor A")
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fingerprint: Mapped[str | None] = mapped_column(String(100), nullable=True)
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(100), default="Screened")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    matched_skills: Mapped[list] = mapped_column(JSON, default=list)
    missing_skills: Mapped[list] = mapped_column(JSON, default=list)
    hiring_manager_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
