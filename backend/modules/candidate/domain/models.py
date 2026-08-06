"""Candidate submission model (MongoDB collection).

The ``candidate_submissions`` collection is produced by the Candidate
Screening Agent (vendor recruiter submissions). This module reads it from the
main app so the Hiring Manager dashboard can surface shortlisted candidates.
"""
from typing import ClassVar

from ...shared.db import Column, Model, _utcnow, _uuid


class CandidateSubmission(Model):
    __tablename__ = "candidate_submissions"

    _fields: ClassVar[dict[str, object]] = {
        "id": _uuid,
        "requisition_id": None,
        "candidate_name": "",
        "candidate_email": None,
        "vendor_name": "Vendor A",
        "filename": None,
        "fingerprint": None,
        "match_score": None,
        "recommendation": None,
        "status": "Screened",
        "summary": None,
        "details": dict,
        "matched_skills": list,
        "missing_skills": list,
        "hiring_manager_notes": None,
        "created_at": _utcnow,
        "updated_at": _utcnow,
    }

    id = Column("id")
    requisition_id = Column("requisition_id")
    candidate_name = Column("candidate_name")
    candidate_email = Column("candidate_email")
    vendor_name = Column("vendor_name")
    filename = Column("filename")
    fingerprint = Column("fingerprint")
    match_score = Column("match_score")
    recommendation = Column("recommendation")
    status = Column("status")
    summary = Column("summary")
    details = Column("details")
    matched_skills = Column("matched_skills")
    missing_skills = Column("missing_skills")
    hiring_manager_notes = Column("hiring_manager_notes")
    created_at = Column("created_at")
    updated_at = Column("updated_at")
