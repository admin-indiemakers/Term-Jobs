import os
import shutil
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
try:
    from services.pdf_parser import extract_text_from_pdf
    from services.scoring import rank_candidates
    from services.db_service import (
        fetch_published_requisitions, 
        fetch_requisition_by_id,
        save_candidate_submission,
        update_candidate_status_in_db,
        fetch_candidates_from_db
    )
    from services.email_service import send_shortlist_notification, send_rejection_notification
except ImportError:
    from modules.candidate_screening_agent.services.pdf_parser import extract_text_from_pdf
    from modules.candidate_screening_agent.services.scoring import rank_candidates
    from modules.candidate_screening_agent.services.db_service import (
        fetch_published_requisitions, 
        fetch_requisition_by_id,
        save_candidate_submission,
        update_candidate_status_in_db,
        fetch_candidates_from_db
    )
    from modules.candidate_screening_agent.services.email_service import send_shortlist_notification, send_rejection_notification

from modules.identity.domain.models import User
from modules.identity.router import get_current_user

router = APIRouter()

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# In-memory candidate cache for active screening session
CANDIDATE_STORE: List[dict] = []


def _tenant_filter(current_user: User) -> tuple[str | None, list[str] | None]:
    """Return (tenant_id, company_tenant_ids) scope for the current user.

    Super Admin sees all (None, None). Recruiters (vendors) only see
    requisitions from companies that engaged their consultancy.
    """
    if current_user.role == "Super Admin":
        return None, None

    if current_user.role == "Recruiter":
        from modules.identity.domain.models import VendorEngagement
        from modules.shared.db import get_session

        with get_session() as session:
            company_ids = {
                e.tenant_id
                for e in session.query(VendorEngagement)
                .filter(VendorEngagement.vendor_tenant_id == current_user.tenant_id)
                .all()
            }
        return None, list(company_ids or [])

    return current_user.tenant_id, None


class ApprovalRequest(BaseModel):
    submission_id: str
    action: str  # "shortlist" or "reject"
    notes: Optional[str] = None
    vendor_name: Optional[str] = "Vendor A"


@router.get("/api/screening/requisitions")
async def get_db_requisitions(current_user: User = Depends(get_current_user)):
    """Fetch Job Descriptions directly from remote PostgreSQL database."""
    _tenant_id, company_ids = _tenant_filter(current_user)
    requisitions = fetch_published_requisitions(company_tenant_ids=company_ids) if company_ids is not None else fetch_published_requisitions(tenant_id=_tenant_id)
    return {
        "status": "success",
        "count": len(requisitions),
        "requisitions": requisitions
    }


@router.get("/api/screening/requisitions/{req_id}")
async def get_db_requisition_detail(req_id: str, current_user: User = Depends(get_current_user)):
    """Fetch specific Job Description details from MongoDB."""
    _tenant_id, company_ids = _tenant_filter(current_user)
    req = fetch_requisition_by_id(req_id, tenant_id=_tenant_id, company_tenant_ids=company_ids)
    if not req:
        raise HTTPException(status_code=404, detail=f"Requisition ID '{req_id}' not found in database")
    return {
        "status": "success",
        "requisition": req
    }


@router.get("/api/candidates/shortlisted")
async def get_shortlisted_vendor_candidates(requisition_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Fetch ONLY shortlisted candidates from all vendors stored in PostgreSQL, ranked by match score."""
    _tenant_id, company_ids = _tenant_filter(current_user)
    candidates = fetch_candidates_from_db(requisition_id=requisition_id, status="Shortlisted", tenant_id=_tenant_id, company_tenant_ids=company_ids)
    return {
        "status": "success",
        "count": len(candidates),
        "shortlisted_candidates": candidates
    }


@router.post("/api/screen-resumes")
async def screen_multiple_candidates(
    jd: str = Form(...),
    requisition_id: Optional[str] = Form(None),
    vendor_name: Optional[str] = Form("Vendor A"),
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    """Screen multiple uploaded resume PDFs against a Job Description and rank them in memory for Vendor HR review."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    candidates_data = []

    for file in files:
        if not file.filename:
            continue

        file_path = os.path.join(UPLOAD_FOLDER, file.filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        extracted_text = extract_text_from_pdf(file_path)
        candidates_data.append({
            "filename": file.filename,
            "extracted_text": extracted_text
        })

    if not candidates_data:
        raise HTTPException(status_code=400, detail="No valid files processed")

    # Load existing shortlisted submissions from DB for duplicate checking
    existing_db = fetch_candidates_from_db(requisition_id=requisition_id)
    combined_existing = existing_db + CANDIDATE_STORE

    ranking_results = rank_candidates(
        jd=jd,
        candidates=candidates_data,
        existing_submissions=combined_existing
    )

    for cand in ranking_results["ranked_candidates"]:
        submission_id = str(uuid.uuid4())[:8]
        cand["submission_id"] = submission_id
        cand["requisition_id"] = requisition_id
        cand["vendor_name"] = vendor_name or "Vendor A"
        cand["status"] = "Screened"
        cand["email_notification_status"] = "Pending HR Shortlist"
        cand["tenant_id"] = current_user.tenant_id
        CANDIDATE_STORE.append(cand)

    return {
        "status": "success",
        "vendor_name": vendor_name or "Vendor A",
        "analysis": ranking_results
    }


@router.get("/approval-queue")
async def get_approval_queue(requisition_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Retrieve candidates queued for Vendor HR review."""
    _tenant_id, company_ids = _tenant_filter(current_user)
    tenant_id = _tenant_id
    pending = [
        c for c in CANDIDATE_STORE
        if c.get("status") == "Screened"
        and (tenant_id is None or c.get("tenant_id") == tenant_id)
    ]

    # Fetch shortlisted candidates from PostgreSQL
    db_shortlisted = fetch_candidates_from_db(requisition_id=requisition_id, status="Shortlisted", tenant_id=tenant_id, company_tenant_ids=company_ids)

    return {
        "status": "success",
        "total_queued": len(pending),
        "total_shortlisted": len(db_shortlisted),
        "approval_queue": pending,
        "shortlisted_candidates": db_shortlisted,
    }


@router.post("/approve-candidate")
async def approve_candidate(req: ApprovalRequest, current_user: User = Depends(get_current_user)):
    """Transition candidate status: ONLY save to PostgreSQL when Vendor HR approves & Shortlists a candidate."""
    action = req.action.lower()
    if action not in ["shortlist", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'shortlist' or 'reject'")

    _tenant_id, company_ids = _tenant_filter(current_user)
    tenant_id = _tenant_id

    # Search candidate in memory screening cache
    target_cand = next((c for c in CANDIDATE_STORE if c.get("submission_id") == req.submission_id), None)

    if not target_cand:
        # Search in DB
        db_candidates = fetch_candidates_from_db(tenant_id=tenant_id, company_tenant_ids=company_ids)
        target_cand = next((c for c in db_candidates if c["submission_id"] == req.submission_id), None)

    if not target_cand:
        raise HTTPException(status_code=404, detail=f"Submission ID '{req.submission_id}' not found")

    if tenant_id is not None and target_cand.get("tenant_id") not in (None, tenant_id):
        raise HTTPException(status_code=403, detail="You do not have access to this candidate")

    old_status = target_cand.get("status", "Screened")
    
    if action == "shortlist":
        # Enforce how many candidates this vendor can submit for one
        # requisition. The per-account cap (set in the Super Admin console)
        # wins; otherwise the platform-wide default (3) applies.
        from modules.shared.settings import get_max_candidates_per_requisition

        requisition_id = target_cand.get("requisition_id")
        if requisition_id:
            limit = current_user.candidate_limit or get_max_candidates_per_requisition()
            vendor_tenant = current_user.tenant_id
            already_submitted = [
                c
                for c in fetch_candidates_from_db(requisition_id=requisition_id, status="Shortlisted")
                if c.get("tenant_id") == vendor_tenant
                and c.get("submission_id") != req.submission_id
            ]
            if len(already_submitted) >= limit:
                raise HTTPException(
                    status_code=400,
                    detail=f"You have reached the limit of {limit} candidate submissions for this requisition.",
                )

        new_status = "Shortlisted"
        target_cand["status"] = new_status
        target_cand["vendor_name"] = req.vendor_name or target_cand.get("vendor_name", "Vendor A")
        target_cand["hiring_manager_notes"] = req.notes or ""

        # ONLY SAVE TO POSTGRESQL WHEN SHORTLISTED BY VENDOR HR
        save_candidate_submission(target_cand, requisition_id=target_cand.get("requisition_id"), vendor_name=target_cand["vendor_name"], tenant_id=target_cand.get("tenant_id"))
        update_candidate_status_in_db(req.submission_id, "Shortlisted", req.notes)

        # Send Gmail notification
        email_result = {"status": "skipped", "reason": "No email found in resume"}
        if target_cand.get("candidate_email"):
            email_result = send_shortlist_notification(
                candidate_name=target_cand["candidate_name"],
                candidate_email=target_cand["candidate_email"],
                job_title="DevOps Position",
                notes=req.notes
            )
        target_cand["email_notification_status"] = email_result.get("message") or email_result.get("error") or email_result.get("reason")
        
        return {
            "status": "success",
            "message": f"Candidate successfully SHORTLISTED & SAVED TO POSTGRESQL! State: {old_status} -> {new_status}",
            "email_notification": email_result,
            "candidate": target_cand
        }
    else:
        new_status = "Rejected"
        target_cand["status"] = new_status

        # Send rejection email notification
        email_result = {"status": "skipped", "reason": "No email found in resume"}
        if target_cand.get("candidate_email"):
            email_result = send_rejection_notification(
                candidate_name=target_cand["candidate_name"],
                candidate_email=target_cand["candidate_email"],
                job_title="DevOps Position",
                notes=req.notes
            )
        target_cand["email_notification_status"] = email_result.get("message") or email_result.get("error") or email_result.get("reason")

        return {
            "status": "success",
            "message": f"Candidate REJECTED. State: {old_status} -> {new_status} (Not saved in PostgreSQL)",
            "email_notification": email_result,
            "candidate": target_cand
        }


@router.post("/test-screen")
async def test_screen(vendor_name: str = "Vendor A", current_user: User = Depends(get_current_user)):
    """Test endpoint for vendor screening without initial DB persistence."""
    jd = """
    Senior Python & FastAPI Developer
    
    Required Skills:
    - Python
    - FastAPI
    - PostgreSQL
    - Docker
    
    Experience:
    - 3+ years experience building scalable backend APIs.
    """

    candidate_1_text = """
    Mohammed Hashil
    Email: mohammed.hashil@example.com
    Senior Backend Engineer
    Experience: 4 years building APIs with Python, FastAPI, PostgreSQL, Docker, and Redis.
    Skills: Python, FastAPI, PostgreSQL, Docker, Microservices, Git.
    """

    candidate_2_text = """
    Jane Smith
    Email: jane.smith@example.com
    Frontend Developer
    Experience: 2 years building UIs with React and JavaScript.
    Skills: HTML, CSS, JavaScript, React.
    """

    candidate_3_text = """
    Alex Johnson
    Email: alex.johnson@example.com
    Python Developer
    Experience: 1 year building web scripts in Python and Flask.
    Skills: Python, Flask, SQLite.
    """

    candidates_data = [
        {"filename": "mohammed_hashil_resume.pdf", "extracted_text": candidate_1_text},
        {"filename": "jane_smith_resume.pdf", "extracted_text": candidate_2_text},
        {"filename": "alex_johnson_resume.pdf", "extracted_text": candidate_3_text},
    ]

    existing_db = fetch_candidates_from_db()
    combined_existing = existing_db + CANDIDATE_STORE

    ranking_results = rank_candidates(
        jd=jd,
        candidates=candidates_data,
        existing_submissions=combined_existing
    )

    for cand in ranking_results["ranked_candidates"]:
        submission_id = str(uuid.uuid4())[:8]
        cand["submission_id"] = submission_id
        cand["vendor_name"] = vendor_name
        cand["status"] = "Screened"
        cand["email_notification_status"] = "Pending HR Shortlist"
        cand["tenant_id"] = current_user.tenant_id
        CANDIDATE_STORE.append(cand)

    return {
        "status": "success",
        "vendor_name": vendor_name,
        "job_description": jd.strip(),
        "analysis": ranking_results
    }