"""FastAPI router exposing candidate submissions for the Hiring Manager UI."""
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from modules.candidate.domain.models import CandidateSubmission
from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.requisition.domain.models import CompanyProfile, Requisition
from modules.shared.db import get_session

router = APIRouter(prefix="/candidates", tags=["Candidates"])

RESUME_UPLOAD_DIRS = [
    os.path.join(os.path.dirname(__file__), "..", "candidate_screening_agent", "uploads"),
    os.path.join(os.path.dirname(__file__), "..", "..", "uploads"),
    "uploads",
]


def _tenant_requisition_ids(session, tenant_id: str) -> set[str]:
    """IDs of all requisitions belonging to a tenant."""
    rows = session.query(Requisition).filter(Requisition.tenant_id == tenant_id).all()
    return {r.id for r in rows}


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
        "requisition_ref": f"REQ-{str(row.requisition_id)[:6].upper()}" if row.requisition_id else None,
        "requisition_title": req.title if req else None,
        "company_name": company.name if company else None,
        "candidate_name": row.candidate_name,
        "candidate_email": row.candidate_email,
        "vendor_name": row.vendor_name,
        "filename": row.filename,
        "resume_text": row.resume_text,
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
def list_candidates(
    status: str | None = None,
    requisition_id: str | None = None,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List candidate submissions, optionally filtered by status and/or requisition."""
    with get_session() as session:
        query = session.query(CandidateSubmission).order_by(CandidateSubmission.created_at.desc())
        if status:
            query = query.filter(CandidateSubmission.status == status)
        if requisition_id:
            query = query.filter(CandidateSubmission.requisition_id == requisition_id)
        if current_user.role != "Super Admin":
            tenant_reqs = _tenant_requisition_ids(session, current_user.tenant_id)
            query = query.filter(CandidateSubmission.requisition_id.in_(tenant_reqs or {""}))
        return [_candidate_dict(session, row) for row in query.all()]


@router.get("/shortlisted")
def list_shortlisted(current_user: User = Depends(get_current_user)) -> list[dict]:
    """Shortcut for the shortlisted candidates queue."""
    with get_session() as session:
        query = (
            session.query(CandidateSubmission)
            .filter(CandidateSubmission.status == "Shortlisted")
            .order_by(
                CandidateSubmission.match_score.desc().nulls_last(),
                CandidateSubmission.created_at.desc(),
            )
        )
        if current_user.role != "Super Admin":
            tenant_reqs = _tenant_requisition_ids(session, current_user.tenant_id)
            query = query.filter(CandidateSubmission.requisition_id.in_(tenant_reqs or {""}))
        return [_candidate_dict(session, row) for row in query.all()]


@router.get("/{candidate_id}/resume")
def get_candidate_resume(candidate_id: str, current_user: User = Depends(get_current_user)):
    """Serve the original resume PDF for a candidate, if it still exists on disk."""
    with get_session() as session:
        row = session.get(CandidateSubmission, candidate_id)
        if row is None:
            raise HTTPException(status_code=404, detail="candidate not found")
        if current_user.role != "Super Admin":
            tenant_reqs = _tenant_requisition_ids(session, current_user.tenant_id)
            if row.requisition_id not in tenant_reqs:
                raise HTTPException(
                    status_code=403,
                    detail="You do not have access to this candidate",
                )
        if not row.filename:
            raise HTTPException(status_code=404, detail="No resume file stored for this candidate")

        for directory in RESUME_UPLOAD_DIRS:
            if not directory:
                continue
            path = os.path.join(directory, row.filename)
            if os.path.exists(path):
                return FileResponse(
                    path,
                    media_type="application/pdf",
                    filename=row.filename,
                )

    # Fallback: find the PDF anywhere under the screening agent uploads folder
    base = os.path.join(os.path.dirname(__file__), "..", "candidate_screening_agent", "uploads")
    if os.path.isdir(base):
        for fname in os.listdir(base):
            if row.filename and row.filename.split("_")[0].lower() in fname.lower() and fname.lower().endswith(".pdf"):
                path = os.path.join(base, fname)
                if os.path.exists(path):
                    return FileResponse(path, media_type="application/pdf", filename=fname)

    raise HTTPException(status_code=404, detail="Resume PDF not found on the server")


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str, current_user: User = Depends(get_current_user)) -> dict:
    with get_session() as session:
        row = session.get(CandidateSubmission, candidate_id)
        if row is None:
            raise HTTPException(status_code=404, detail="candidate not found")
        if current_user.role != "Super Admin":
            tenant_reqs = _tenant_requisition_ids(session, current_user.tenant_id)
            if row.requisition_id not in tenant_reqs:
                raise HTTPException(
                    status_code=403,
                    detail="You do not have access to this candidate",
                )
        return _candidate_dict(session, row)
