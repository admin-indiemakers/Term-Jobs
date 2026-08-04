import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from backend.modules.candidate.domain.models import Candidate, Submission, SubmissionStatus
from backend.modules.candidate.domain.state_machine import SubmissionStateMachine, InvalidStateTransitionException
from backend.modules.candidate.agent.graph import CandidateScreeningAgentGraph
from backend.modules.candidate.tools.pdf_parser import PDFParser
from backend.modules.candidate.repository.decision_record import DecisionRecordRepository, DecisionRecord

router = APIRouter(prefix="/api/candidate", tags=["Candidate Screening"])

candidates_db: Dict[str, Candidate] = {}
submissions_db: Dict[str, Submission] = {}

class ScreenRequest(BaseModel):
    tenant_id: str = Field(default="tenant_default")
    name: str = Field(..., example="Rahul Sharma")
    email: str = Field(..., example="rahul.sharma@example.com")
    phone: str = Field(..., example="+919876543210")
    resume_text: str = Field(..., example="Senior Backend Engineer with 5 years experience in Python, FastAPI, PostgreSQL, and Docker.")
    requisition_id: str = Field(..., example="req_python_dev")
    requisition_data: Dict[str, Any] = Field(
        default_factory=lambda: {
            "title": "Senior Backend Engineer",
            "must_have_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
            "nice_to_have_skills": ["LangGraph", "Redis"],
            "seniority": "Senior"
        }
    )

@router.post("/screen", summary="Submit single candidate resume text and trigger Candidate Screening Agent")
def screen_candidate(req: ScreenRequest):
    cand_id = f"cand_{uuid.uuid4().hex[:8]}"
    candidate = Candidate(
        id=cand_id,
        tenant_id=req.tenant_id,
        name=req.name,
        email=req.email,
        phone=req.phone,
        resume_text=req.resume_text,
        skills=[]
    )
    candidates_db[cand_id] = candidate

    sub_id = f"sub_{uuid.uuid4().hex[:8]}"
    submission = Submission(
        id=sub_id,
        candidate_id=cand_id,
        requisition_id=req.requisition_id,
        status=SubmissionStatus.SUBMITTED
    )
    submissions_db[sub_id] = submission

    existing_cands = list(candidates_db.values())
    existing_subs = list(submissions_db.values())

    result = CandidateScreeningAgentGraph.run(
        candidate=candidate,
        submission=submission,
        requisition_data=req.requisition_data,
        existing_candidates=existing_cands,
        existing_submissions=existing_subs
    )

    submissions_db[sub_id] = result["submission"]

    return {
        "message": "Candidate screening completed successfully",
        "candidate": candidate,
        "submission": result["submission"],
        "screening_output": result["screening_output"],
        "decision_record_id": result["decision_record"].id,
        "agent_status": result["status"]
    }

@router.post("/screen-bulk-pdfs", summary="Upload multiple PDF resume files for batch candidate screening")
async def screen_bulk_pdfs(
    requisition_id: str = Form("req_python_dev"),
    files: List[UploadFile] = File(...)
):
    """
    Accepts multiple PDF resume files, extracts text & contact info from each PDF,
    runs the Candidate Screening Agent graph, detects duplicates, and returns ranked results.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No PDF files provided")

    requisition_data = {
        "title": "Senior Backend Engineer",
        "must_have_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "nice_to_have_skills": ["LangGraph", "Redis"],
        "seniority": "Senior"
    }

    results = []
    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            continue

        pdf_bytes = await file.read()
        parsed = PDFParser.parse_resume(pdf_bytes, file.filename)

        cand_id = f"cand_{uuid.uuid4().hex[:8]}"
        candidate = Candidate(
            id=cand_id,
            tenant_id="tenant_default",
            name=parsed["name"],
            email=parsed["email"],
            phone=parsed["phone"],
            resume_text=parsed["resume_text"],
            skills=[]
        )
        candidates_db[cand_id] = candidate

        sub_id = f"sub_{uuid.uuid4().hex[:8]}"
        submission = Submission(
            id=sub_id,
            candidate_id=cand_id,
            requisition_id=requisition_id,
            status=SubmissionStatus.SUBMITTED
        )
        submissions_db[sub_id] = submission

        existing_cands = list(candidates_db.values())
        existing_subs = list(submissions_db.values())

        res = CandidateScreeningAgentGraph.run(
            candidate=candidate,
            submission=submission,
            requisition_data=requisition_data,
            existing_candidates=existing_cands,
            existing_submissions=existing_subs
        )
        submissions_db[sub_id] = res["submission"]

        results.append({
            "filename": file.filename,
            "candidate_name": candidate.name,
            "email": candidate.email,
            "fit_score": res["screening_output"].overall_fit_score,
            "recommendation": res["screening_output"].recommendation,
            "is_duplicate": res["screening_output"].duplicate_flags.is_duplicate,
            "submission_id": submission.id,
            "status": res["submission"].status
        })

    # Sort candidates by Fit Score descending
    results.sort(key=lambda x: x["fit_score"], reverse=True)

    return {
        "message": f"Processed {len(results)} PDF resumes successfully",
        "total_screened": len(results),
        "ranked_candidates": results
    }

@router.get("/submissions", summary="List all candidate submissions")
def list_submissions():
    return list(submissions_db.values())

@router.get("/decision-records", summary="List all auditable screening decision records")
def list_decision_records():
    return DecisionRecordRepository.list_all()

@router.post("/submissions/{submission_id}/shortlist", summary="Hiring Manager Action: Shortlist candidate")
def shortlist_candidate(submission_id: str):
    sub = submissions_db.get(submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    try:
        updated_sub = SubmissionStateMachine.transition(sub, SubmissionStatus.SHORTLISTED)
        submissions_db[submission_id] = updated_sub
        return {
            "message": f"Submission {submission_id} moved to Shortlisted.",
            "submission": updated_sub
        }
    except InvalidStateTransitionException as e:
        raise HTTPException(status_code=400, detail=str(e))
