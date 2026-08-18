import base64
"""
Resume Screener Router — plugs into Term-Jobs FastAPI backend.

Replaces: modules/candidate_screening_agent/routers/screening.py

Endpoints:
  POST /api/screen-resumes   — run AI pipeline on uploaded PDFs vs JD
  GET  /api/screening/requisitions — list published requisitions (kept for UI compat)

Shortlisting (POST /candidates/shortlist) is handled by candidate/router.py — unchanged.
Only shortlisted candidates are saved to MongoDB candidate_submissions.
"""
import os
import uuid
import asyncio
import logging
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.resume_screener.pipeline.extractor import extract_text
from modules.resume_screener.pipeline.structurer import structure_resume
from modules.resume_screener.pipeline.jd_parser import parse_jd, generate_embedding
from modules.resume_screener.pipeline.github_agent import verify_github
from modules.resume_screener.pipeline.scorer import compute_score, classify_candidate
from modules.resume_screener.models.schemas import GitHubEvidence

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_FOLDER = "uploads/screening"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ---------------------------------------------------------------------------
# Helper: process a single resume through the full pipeline
# ---------------------------------------------------------------------------

async def _process_resume(
    file_path: str,
    file_type: str,
    filename: str,
    jd_parsed,
    jd_embedding: List[float],
) -> dict:
    """Run stages 2-6 for one resume. Returns a result dict."""
    try:
        # Stage 2 — Extract text
        raw_text = extract_text(file_path, file_type)

        # Stage 3 — Structure with LLM
        structured = await structure_resume(raw_text)

        # Stage 4 — GitHub verification (if profile found)
        github_evidence = None
        if structured.github_url:
            try:
                github_evidence = await verify_github(structured.github_url)
            except Exception as e:
                logger.warning(f"[{filename}] GitHub verification failed: {e}")
                github_evidence = GitHubEvidence(verified=False, error=str(e))

        # Stage 5 — Score
        total_score, breakdown, matched, missing = compute_score(
            structured, jd_parsed, jd_embedding, github_evidence
        )

        category = classify_candidate(total_score)
        pdf_b64 = None
        if os.path.exists(file_path):
            try:
                pdf_b64 = base64.b64encode(Path(file_path).read_bytes()).decode('utf-8')
            except Exception:
                pass

        return {
            "filename": filename,
            "candidate_name": structured.name or Path(filename).stem,
            "candidate_email": structured.email or "",
            "match_score": round(total_score, 2),
            "recommendation": category.value,
            "status": "Screened",
            "matched_skills": matched,
            "missing_skills": missing,
            "summary": _build_summary(structured, matched, missing, total_score),
            "score_breakdown": {
                "must_have_skills": round(breakdown.must_have_skills, 2),
                "project_evidence": round(breakdown.project_evidence, 2),
                "semantic_relevance": round(breakdown.semantic_relevance, 2),
                "github_evidence": round(breakdown.github_evidence, 2),
                "problem_solving": round(breakdown.problem_solving, 2),
                "nice_to_have_skills": round(breakdown.nice_to_have_skills, 2),
                "experience_alignment": round(breakdown.experience_alignment, 2),
                "education_relevance": round(breakdown.education_relevance, 2),
            },
            "github_verified": bool(github_evidence and github_evidence.verified),
            "resume_pdf": pdf_b64,
            "error": None,
        }

    except Exception as e:
        logger.error(f"[{filename}] Pipeline error: {e}", exc_info=True)
        return {
            "filename": filename,
            "candidate_name": Path(filename).stem,
            "candidate_email": "",
            "match_score": 0.0,
            "recommendation": "ERROR",
            "status": "Error",
            "matched_skills": [],
            "missing_skills": [],
            "summary": f"Processing error: {e}",
            "score_breakdown": {},
            "github_verified": False,
            "error": str(e),
        }


def _build_summary(structured, matched, missing, score) -> str:
    """Build a human-readable summary for the screened candidate."""
    name = structured.name or "This candidate"
    if score >= 80:
        label = "strongly aligned"
    elif score >= 60:
        label = "moderately aligned"
    else:
        label = "partially aligned"

    parts = [f"{name} is {label} with the job requirements (score: {round(score)}%)."]
    if matched:
        parts.append(f"Matched skills: {', '.join(matched[:5])}{'...' if len(matched) > 5 else ''}.")
    if missing:
        parts.append(f"Missing: {', '.join(missing[:4])}{'...' if len(missing) > 4 else ''}.")
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Helper: persist screened candidates so Hiring Managers can review & shortlist
# ---------------------------------------------------------------------------

def _persist_screened_candidates(results, requisition_id, jd_text, vendor_name, tenant_id):
    """Save Screened candidates to candidate_submissions (skipping ones already submitted).

    Only candidates that are not already on record for this requisition (matched
    by email or name) are inserted, so we never overwrite an existing
    Shortlisted/Rejected decision.
    """
    try:
        from modules.candidate_screening_agent.services.db_service import (
            fetch_candidates_from_db,
            save_candidate_submission,
        )
    except Exception:
        return

    existing_keys = set()
    for c in fetch_candidates_from_db(requisition_id=requisition_id):
        email = (c.get("candidate_email") or "").strip().lower()
        name = (c.get("candidate_name") or "").strip().lower()
        if email:
            existing_keys.add(("email", email))
        if name:
            existing_keys.add(("name", name))

    for r in results:
        if r.get("error") or r.get("status") == "Error":
            continue
        name = (r.get("candidate_name") or "").strip().lower()
        email = (r.get("candidate_email") or "").strip().lower()
        if (email and ("email", email) in existing_keys) or (name and ("name", name) in existing_keys):
            continue
        doc = {
            "candidate_name": r.get("candidate_name") or "",
            "candidate_email": r.get("candidate_email") or None,
            "vendor_name": vendor_name,
            "filename": r.get("filename"),
            "jd_text": jd_text,
            "match_score": r.get("match_score"),
            "recommendation": r.get("recommendation"),
            "status": "Screened",
            "summary": r.get("summary"),
            "details": r.get("score_breakdown") or {},
            "matched_skills": r.get("matched_skills") or [],
            "missing_skills": r.get("missing_skills") or [],
            "resume_pdf": r.get("resume_pdf"),
        }
        try:
            save_candidate_submission(doc, requisition_id=requisition_id, vendor_name=vendor_name, tenant_id=tenant_id)
            existing_keys.add(("email", email) if email else ("name", name))
        except Exception as e:
            logger.warning(f"Could not persist screened candidate {name}: {e}")


# ---------------------------------------------------------------------------
# POST /api/screen-resumes
# ---------------------------------------------------------------------------

@router.post("/screen-resumes")
async def screen_resumes(
    resumes: List[UploadFile] = File(...),
    requisition_id: str = Form(...),
    jd_text: str = Form(""),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Screen one or more resume PDFs against a JD using the AI pipeline.

    Resumes are processed sequentially (Ollama is single-threaded locally).
    Results are NOT saved to DB here — shortlisting happens separately via
    POST /candidates/shortlist when HR/Recruiter clicks the Shortlist button.
    """
    if not resumes:
        raise HTTPException(status_code=400, detail="No resume files provided.")

    # Fetch JD from requisition if not provided inline
    if not jd_text.strip():
        try:
            from modules.shared.db import get_session
            from modules.requisition.domain.models import Requisition
            with get_session() as session:
                req = session.get(Requisition, requisition_id)
                if req:
                    jd_text = req.generated_jd_markdown or ""
        except Exception as e:
            logger.warning(f"Could not fetch JD from requisition: {e}")

    if not jd_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No JD text provided and could not fetch from requisition."
        )

    # Stage 1 — Parse JD (once for all candidates)
    try:
        jd_parsed = await parse_jd(jd_text)
        embedding_text = jd_parsed.embedding_text or jd_text[:500]
        jd_embedding = generate_embedding(embedding_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JD parsing failed: {e}")

    # Save uploaded files to temp dir + process sequentially
    results = []
    tmp_dir = Path(UPLOAD_FOLDER) / str(uuid.uuid4())
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        for upload in resumes:
            filename = upload.filename or f"resume_{uuid.uuid4().hex[:8]}.pdf"
            file_path = str(tmp_dir / filename)
            content = await upload.read()
            Path(file_path).write_bytes(content)

            ext = Path(filename).suffix.lower()
            file_type = "pdf" if ext == ".pdf" else "docx"

            logger.info(f"[screen-resumes] Processing: {filename}")
            result = await _process_resume(file_path, file_type, filename, jd_parsed, jd_embedding)
            results.append(result)

    finally:
        # Clean up temp files
        import shutil
        try:
            shutil.rmtree(str(tmp_dir), ignore_errors=True)
        except Exception:
            pass

    # Rank by score descending
    results.sort(key=lambda x: x["match_score"], reverse=True)
    for rank, r in enumerate(results, 1):
        r["rank"] = rank

    # Persist Screened candidates so Hiring Managers can review and shortlist
    _persist_screened_candidates(
        results,
        requisition_id=requisition_id,
        jd_text=jd_text,
        vendor_name=current_user.tenant_name or "Vendor A",
        tenant_id=current_user.tenant_id,
    )

    return {
        "status": "success",
        "requisition_id": requisition_id,
        "total_candidates_analyzed": len(results),
        "ranked_candidates": results,
        "best_candidate": results[0] if results else None,
    }


# ---------------------------------------------------------------------------
# GET /api/screening/requisitions  (kept for RecruiterDashboard UI compat)
# ---------------------------------------------------------------------------

@router.get("/screening/requisitions")
def list_screening_requisitions(current_user: User = Depends(get_current_user)) -> list:
    """Return published requisitions visible to this user for the screening dropdown."""
    try:
        from modules.shared.db import get_session
        from modules.requisition.domain.models import Requisition
        with get_session() as session:
            reqs = session.query(Requisition).filter(
                Requisition.status == "Published"
            ).all()
            result = []
            for r in reqs:
                # Tenant filter: recruiters see only their engaged companies
                if current_user.role != "Super Admin":
                    if hasattr(r, "tenant_id") and r.tenant_id != current_user.tenant_id:
                        # Check vendor engagement
                        from modules.identity.domain.models import VendorEngagement
                        engaged = session.query(VendorEngagement).filter(
                            VendorEngagement.vendor_tenant_id == current_user.tenant_id,
                            VendorEngagement.tenant_id == r.tenant_id,
                        ).first()
                        if not engaged:
                            continue
                result.append({
                    "id": r.id,
                    "title": getattr(r, "job_title", None) or getattr(r, "title", str(r.id)),
                    "status": r.status,
                    "tenant_id": getattr(r, "tenant_id", None),
                })
            return result
    except Exception as e:
        logger.warning(f"Could not fetch requisitions: {e}")
        return []


# ---------------------------------------------------------------------------
# GET /api/screening/requisitions/{req_id}  (kept for UI compat)
# ---------------------------------------------------------------------------

@router.get("/screening/requisitions/{req_id}")
def get_screening_requisition(req_id: str, current_user: User = Depends(get_current_user)) -> dict:
    """Return a single requisition with JD text for the screening form."""
    try:
        from modules.shared.db import get_session
        from modules.requisition.domain.models import Requisition
        with get_session() as session:
            req = session.get(Requisition, req_id)
            if not req:
                raise HTTPException(status_code=404, detail="Requisition not found")
            return {
                "id": req.id,
                "title": getattr(req, "job_title", None) or getattr(req, "title", req.id),
                "status": req.status,
                "jd_text": req.generated_jd_markdown or "",
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
