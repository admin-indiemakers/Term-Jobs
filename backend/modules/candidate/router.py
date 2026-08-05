"""FastAPI router exposing candidate submissions for the Hiring Manager UI."""
from fastapi import APIRouter, HTTPException

from modules.candidate.domain.models import CandidateSubmission
from modules.requisition.domain.models import CompanyProfile, Requisition
from modules.shared.db import get_session

router = APIRouter(prefix="/candidates", tags=["Candidates"])


def _candidate_dict(session, row: CandidateSubmission) -> dict:
    req = None
    company = None
    if row.requisition_id:
        req = session.get(Requisition, row.requisition_id)
    if req and req.company_profile_id:
        company = session.get(CompanyProfile, req.company_profile_id)
    return {
        "id": row.id,
        "requisition_id": row.requisition_id,
        "requisition_title": req.title if req else None,
        "company_name": company.name if company else None,
        "candidate_name": row.candidate_name,
        "candidate_email": row.candidate_email,
        "vendor_name": row.vendor_name,
        "filename": row.filename,
        "match_score": float(row.match_score) if row.match_score is not None else None,
        "recommendation": row.recommendation,
        "status": row.status,
        "summary": row.summary,
        "matched_skills": row.matched_skills or [],
        "missing_skills": row.missing_skills or [],
        "hiring_manager_notes": row.hiring_manager_notes,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("")
def list_candidates(status: str | None = None, requisition_id: str | None = None) -> list[dict]:
    """List candidate submissions, optionally filtered by status and/or requisition."""
    with get_session() as session:
        query = session.query(CandidateSubmission).order_by(CandidateSubmission.created_at.desc())
        if status:
            query = query.filter(CandidateSubmission.status == status)
        if requisition_id:
            query = query.filter(CandidateSubmission.requisition_id == requisition_id)
        return [_candidate_dict(session, row) for row in query.all()]


@router.get("/shortlisted")
def list_shortlisted() -> list[dict]:
    """Shortcut for the shortlisted candidates queue."""
    with get_session() as session:
        rows = (
            session.query(CandidateSubmission)
            .filter(CandidateSubmission.status == "Shortlisted")
            .order_by(
                CandidateSubmission.match_score.desc().nulls_last(),
                CandidateSubmission.created_at.desc(),
            )
            .all()
        )
        return [_candidate_dict(session, row) for row in rows]


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str) -> dict:
    with get_session() as session:
        row = session.get(CandidateSubmission, candidate_id)
        if row is None:
            raise HTTPException(status_code=404, detail="candidate not found")
        return _candidate_dict(session, row)
