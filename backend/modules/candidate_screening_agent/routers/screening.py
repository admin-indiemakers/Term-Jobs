import os
import shutil
import uuid
from typing import List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from services.pdf_parser import extract_text_from_pdf
from services.scoring import rank_candidates
from services.db_service import fetch_published_requisitions, fetch_requisition_by_id
from services.email_service import send_shortlist_notification, send_rejection_notification

router = APIRouter()

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# In-memory candidate database & Approval Queue store
CANDIDATE_STORE: List[dict] = []


class ApprovalRequest(BaseModel):
    submission_id: str
    action: str  # "shortlist" or "reject"
    notes: Optional[str] = None


@router.get("/requisitions")
async def get_db_requisitions():
    """Fetch Job Descriptions directly from remote PostgreSQL database."""
    requisitions = fetch_published_requisitions()
    return {
        "status": "success",
        "count": len(requisitions),
        "requisitions": requisitions
    }


@router.get("/requisitions/{req_id}")
async def get_db_requisition_detail(req_id: str):
    """Fetch specific Job Description details from PostgreSQL."""
    req = fetch_requisition_by_id(req_id)
    if not req:
        raise HTTPException(status_code=404, detail=f"Requisition ID '{req_id}' not found in database")
    return {
        "status": "success",
        "requisition": req
    }


@router.post("/screen-resumes")
async def screen_multiple_candidates(
    jd: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Screen multiple uploaded resume PDFs against a Job Description, rank them, and store in Approval Queue."""
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

    ranking_results = rank_candidates(
        jd=jd,
        candidates=candidates_data,
        existing_submissions=CANDIDATE_STORE
    )

    for cand in ranking_results["ranked_candidates"]:
        submission_id = str(uuid.uuid4())[:8]
        cand_record = {
            "submission_id": submission_id,
            "job_description_snippet": jd[:100] + "...",
            "candidate_name": cand["candidate_name"],
            "candidate_email": cand.get("candidate_email"),
            "filename": cand["filename"],
            "fingerprint": cand["fingerprint"],
            "status": "Screened",
            "match_score": cand["match_score"],
            "recommendation": cand["recommendation"],
            "is_duplicate": cand["is_duplicate"],
            "duplicate_reason": cand["duplicate_reason"],
            "matched_skills": cand["matched_skills"],
            "missing_skills": cand["missing_skills"],
            "summary": cand["summary"],
            "details": cand["details"],
            "engine_info": cand.get("engine_info", "Cross-Verification Engine"),
            "rank": cand["rank"],
            "email_notification_status": "Pending Human Action"
        }
        CANDIDATE_STORE.append(cand_record)
        cand["submission_id"] = submission_id

    return {
        "status": "success",
        "analysis": ranking_results
    }


@router.get("/approval-queue")
async def get_approval_queue():
    """Retrieve candidates queued for Hiring Manager review (State Machine: Screened -> Shortlisted / Rejected)."""
    pending = [c for c in CANDIDATE_STORE if c["status"] == "Screened"]
    shortlisted = [c for c in CANDIDATE_STORE if c["status"] == "Shortlisted"]
    rejected = [c for c in CANDIDATE_STORE if c["status"] == "Rejected"]

    return {
        "status": "success",
        "total_queued": len(pending),
        "total_shortlisted": len(shortlisted),
        "total_rejected": len(rejected),
        "approval_queue": pending,
        "shortlisted_candidates": shortlisted,
        "rejected_candidates": rejected,
    }


@router.post("/approve-candidate")
async def approve_candidate(req: ApprovalRequest):
    """Transition candidate status in State Machine and automatically trigger Resend email notification."""
    action = req.action.lower()
    if action not in ["shortlist", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'shortlist' or 'reject'")

    for cand in CANDIDATE_STORE:
        if cand["submission_id"] == req.submission_id:
            old_status = cand["status"]
            new_status = "Shortlisted" if action == "shortlist" else "Rejected"
            cand["status"] = new_status
            cand["hiring_manager_notes"] = req.notes or ""

            # Trigger automated email via Resend
            email_result = {"status": "skipped", "reason": "No email found in resume"}
            candidate_email = cand.get("candidate_email")
            
            if candidate_email:
                if action == "shortlist":
                    email_result = send_shortlist_notification(
                        candidate_name=cand["candidate_name"],
                        candidate_email=candidate_email,
                        job_title="Software Position",
                        notes=req.notes
                    )
                else:
                    email_result = send_rejection_notification(
                        candidate_name=cand["candidate_name"],
                        candidate_email=candidate_email,
                        job_title="Software Position",
                        notes=req.notes
                    )

            cand["email_notification_status"] = email_result.get("message") or email_result.get("error") or email_result.get("reason")

            return {
                "status": "success",
                "message": f"Candidate state updated from {old_status} -> {new_status}",
                "email_notification": email_result,
                "candidate": cand
            }

    raise HTTPException(status_code=404, detail=f"Submission ID '{req.submission_id}' not found")


@router.post("/test-screen")
async def test_screen():
    """Test endpoint with sample JD and fake candidate resumes including candidate email addresses."""
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

    candidate_4_text = candidate_1_text

    candidates_data = [
        {"filename": "mohammed_hashil_resume.pdf", "extracted_text": candidate_1_text},
        {"filename": "jane_smith_resume.pdf", "extracted_text": candidate_2_text},
        {"filename": "alex_johnson_resume.pdf", "extracted_text": candidate_3_text},
        {"filename": "mohammed_hashil_duplicate.pdf", "extracted_text": candidate_4_text},
    ]

    ranking_results = rank_candidates(
        jd=jd,
        candidates=candidates_data,
        existing_submissions=CANDIDATE_STORE
    )

    for cand in ranking_results["ranked_candidates"]:
        submission_id = str(uuid.uuid4())[:8]
        cand_record = {
            "submission_id": submission_id,
            "job_description_snippet": jd[:100] + "...",
            "candidate_name": cand["candidate_name"],
            "candidate_email": cand.get("candidate_email"),
            "filename": cand["filename"],
            "fingerprint": cand["fingerprint"],
            "status": "Screened",
            "match_score": cand["match_score"],
            "recommendation": cand["recommendation"],
            "is_duplicate": cand["is_duplicate"],
            "duplicate_reason": cand["duplicate_reason"],
            "matched_skills": cand["matched_skills"],
            "missing_skills": cand["missing_skills"],
            "summary": cand["summary"],
            "details": cand["details"],
            "engine_info": cand.get("engine_info", "Cross-Verification Engine"),
            "rank": cand["rank"],
            "email_notification_status": "Pending Human Action"
        }
        CANDIDATE_STORE.append(cand_record)
        cand["submission_id"] = submission_id

    return {
        "status": "success",
        "job_description": jd.strip(),
        "analysis": ranking_results
    }