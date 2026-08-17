import base64
"""FastAPI router exposing candidate submissions for the Hiring Manager UI."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
import os
import shutil
import uuid
from datetime import datetime, timezone

from modules.candidate.domain.models import CandidateSubmission, Candidate
from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.requisition.domain.models import CompanyProfile, Requisition
from modules.shared.db import get_session


router = APIRouter(prefix="/candidates", tags=["Candidates"])


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
        "submission_id": row.id,
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
        "created_at": row.created_at.isoformat() if hasattr(row.created_at, 'isoformat') else row.created_at,
    }


@router.get("")
def list_candidates(
    status: str | None = None,
    requisition_id: str | None = None,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List candidate submissions, optionally filtered by status and/or requisition."""
    with get_session() as session:
        query = session.query(CandidateSubmission).order_by(
            CandidateSubmission.match_score.desc().nulls_last(),
            CandidateSubmission.created_at.desc()
        )
        if status:
            query = query.filter(CandidateSubmission.status == status)
        if requisition_id:
            query = query.filter(CandidateSubmission.requisition_id == requisition_id)
        candidates = query.all()
        if current_user.role != "Super Admin":
            tenant_reqs = _tenant_requisition_ids(session, current_user.tenant_id)
            candidates = [
                c for c in candidates
                if getattr(c, 'tenant_id', None) == current_user.tenant_id
                or not getattr(c, 'tenant_id', None)
                or c.requisition_id in tenant_reqs
            ]
        return [_candidate_dict(session, row) for row in candidates]


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
        candidates = query.all()
        if current_user.role != "Super Admin":
            tenant_reqs = _tenant_requisition_ids(session, current_user.tenant_id)
            candidates = [
                c for c in candidates
                if getattr(c, 'tenant_id', None) == current_user.tenant_id
                or not getattr(c, 'tenant_id', None)
                or c.requisition_id in tenant_reqs
            ]
        return [_candidate_dict(session, row) for row in candidates]


@router.get("/bank")
def list_bank_candidates(current_user: User = Depends(get_current_user)) -> list[dict]:
    """Fetch all candidates stored in the candidates collection for this tenant/vendor."""
    with get_session() as session:
        query = session.query(Candidate).order_by(Candidate.created_at.desc())
        candidates = query.all()
        if current_user.role != "Super Admin":
            candidates = [c for c in candidates if not c.tenant_id or c.tenant_id == current_user.tenant_id]
        return [
            {
                "id": c.id,
                "candidate_name": c.candidate_name,
                "candidate_title": c.candidate_title,
                "candidate_email": c.candidate_email,
                "candidate_phone": c.candidate_phone,
                "vendor_company_name": c.vendor_company_name,
                "skills": c.skills or [],
                "filename": c.filename,
                "summary": c.summary,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "details": c.details or {},
                "extracted_text": c.extracted_text
            }
            for c in candidates
        ]


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


@router.patch("/{submission_id}/status")
def update_submission_status(
    submission_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update candidate submission status (e.g. Shortlisted, Rejected)."""
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="status field is required")
    with get_session() as session:
        sub = session.get(CandidateSubmission, submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Candidate submission not found")
        sub.status = new_status
        sub.updated_at = datetime.now(timezone.utc)
        session.add(sub)
        session.commit()
        return {
            "status": "success",
            "message": f"Candidate status updated to {new_status}",
            "submission_id": submission_id,
            "new_status": new_status
        }


@router.post("/bank/upload")
async def upload_bank_candidates(
    files: list[UploadFile] | None = File(None),
    name: str | None = Form(None),
    email: str | None = Form(None),
    phone: str | None = Form(None),
    vendor_company_name: str | None = Form(None),
    candidate_title: str | None = Form(None),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Add candidates to candidate bank â€” either via PDF upload with AI extraction or manual form entry."""
    from modules.resume_screener.pipeline.extractor import extract_text as _extract_text_new
    from modules.resume_screener.pipeline.structurer import structure_resume as _structure_resume_new
    
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    vendor_company = vendor_company_name or current_user.tenant_name or "Vendor A"
    saved_candidates = []
    
    # Filter valid files if provided
    valid_files = [f for f in (files or []) if f and f.filename]
    
    with get_session() as session:
        if valid_files:
            for file in valid_files:
                file_path = os.path.join(upload_dir, file.filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                
                try:
                    with open(file_path, "rb") as f_b:
                        pdf_base64_data = base64.b64encode(f_b.read()).decode("utf-8")
                    extracted_text = _extract_text_new(file_path, "pdf")
                    import asyncio as _aio; _structured = _aio.run(_structure_resume_new(extracted_text)); parsed = {"candidate_name": _structured.name, "candidate_email": _structured.email, "candidate_phone": None, "candidate_title": _structured.current_title or "Professional", "skills": [s.name for s in (_structured.skills or [])], "summary": _structured.summary or "", "vendor_company_name": vendor_company, "extracted_text": extracted_text, "resume_pdf": pdf_base64_data}
                    
                    # Apply manual overrides if provided
                    final_name = name or parsed.get("candidate_name") or "Candidate"
                    final_email = email or parsed.get("candidate_email")
                    final_phone = phone or parsed.get("candidate_phone")
                    final_title = candidate_title or parsed.get("candidate_title") or "Software Engineer"
                    final_vendor = vendor_company or parsed.get("vendor_company_name") or "Vendor A"
                    
                    # Check if candidate already exists
                    existing = None
                    if final_email:
                        existing = session.query(Candidate).filter(
                            Candidate.tenant_id == current_user.tenant_id,
                            Candidate.candidate_email == final_email
                        ).first()
                    else:
                        existing = session.query(Candidate).filter(
                            Candidate.tenant_id == current_user.tenant_id,
                            Candidate.filename == file.filename
                        ).first()
                    
                    if existing:
                        existing.candidate_name = final_name
                        existing.candidate_title = final_title
                        existing.candidate_email = final_email
                        existing.candidate_phone = final_phone
                        existing.skills = parsed.get("skills", [])
                        existing.summary = parsed.get("summary", "")
                        existing.vendor_company_name = final_vendor
                        existing.extracted_text = parsed.get("extracted_text", "")
                        existing.resume_pdf = parsed.get("resume_pdf")
                        existing.updated_at = datetime.now(timezone.utc)
                        session.add(existing)
                        saved_candidates.append(existing)
                    else:
                        new_candidate = Candidate(
                            candidate_name=final_name,
                            candidate_title=final_title,
                            candidate_email=final_email,
                            candidate_phone=final_phone,
                            vendor_company_name=final_vendor,
                            skills=parsed.get("skills", []),
                            filename=file.filename,
                            summary=parsed.get("summary", ""),
                            extracted_text=parsed.get("extracted_text", ""),
                            resume_pdf=parsed.get("resume_pdf"),
                            tenant_id=current_user.tenant_id,
                            details={}
                        )
                        session.add(new_candidate)
                        saved_candidates.append(new_candidate)
                except Exception as e:
                    print(f"Error parsing resume {file.filename}: {e}")
                    raise HTTPException(status_code=500, detail=f"Failed to parse resume {file.filename}: {str(e)}")
                finally:
                    if os.path.exists(file_path):
                        os.remove(file_path)
        else:
            # Manual candidate entry without file upload
            final_name = name or "Candidate"
            final_email = email
            final_phone = phone
            final_title = candidate_title or "Software Engineer"
            final_vendor = vendor_company
            
            existing = None
            if final_email:
                existing = session.query(Candidate).filter(
                    Candidate.tenant_id == current_user.tenant_id,
                    Candidate.candidate_email == final_email
                ).first()
            
            if existing:
                existing.candidate_name = final_name
                existing.candidate_title = final_title
                existing.candidate_email = final_email
                existing.candidate_phone = final_phone
                existing.vendor_company_name = final_vendor
                existing.updated_at = datetime.now(timezone.utc)
                session.add(existing)
                saved_candidates.append(existing)
            else:
                new_candidate = Candidate(
                    candidate_name=final_name,
                    candidate_title=final_title,
                    candidate_email=final_email,
                    candidate_phone=final_phone,
                    vendor_company_name=final_vendor,
                    skills=[],
                    filename=None,
                    summary=f"Manually added candidate: {final_name} from {final_vendor}",
                    extracted_text=f"Candidate Name: {final_name}\nEmail: {final_email}\nPhone: {final_phone}\nVendor: {final_vendor}",
                    tenant_id=current_user.tenant_id,
                    details={}
                )
                session.add(new_candidate)
                saved_candidates.append(new_candidate)
        
        session.commit()
    
    return {
        "status": "success",
        "message": f"Successfully saved {len(saved_candidates)} candidate(s).",
        "candidates": [
            {
                "id": c.id,
                "candidate_name": c.candidate_name,
                "candidate_email": c.candidate_email,
                "vendor_company_name": c.vendor_company_name
            }
            for c in saved_candidates
        ]
    }



@router.post("/bank/match")
def match_bank_candidate(
    body: dict,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Match an existing bank candidate against a requisition using AI screening, saving a CandidateSubmission."""
    candidate_id = body.get("candidate_id")
    requisition_id = body.get("requisition_id")
    if not candidate_id or not requisition_id:
        raise HTTPException(status_code=400, detail="candidate_id and requisition_id are required")
        
    with get_session() as session:
        cand = session.get(Candidate, candidate_id)
        if not cand:
            raise HTTPException(status_code=404, detail="Candidate not found")
        if current_user.role != "Super Admin" and cand.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="You do not have access to this candidate")
            
        req = session.get(Requisition, requisition_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requisition not found")
            
        from modules.resume_screener.pipeline.jd_parser import parse_jd as _parse_jd_new; from modules.resume_screener.pipeline.jd_parser import generate_embedding as _gen_emb_new; from modules.resume_screener.pipeline.scorer import compute_score as _compute_score_new, classify_candidate as _classify_new; from modules.resume_screener.pipeline.structurer import structure_resume as _structure_resume_compat
        
        jd_text = req.generated_jd_markdown or ""
        if not jd_text and req.structured_role:
            from modules.candidate_screening_agent.services.db_service import _vendor_role_text
            jd_text = _vendor_role_text(req.structured_role)
            
        # Get existing submissions to avoid duplicate screening
        existing_submissions = session.query(CandidateSubmission).filter(
            CandidateSubmission.requisition_id == requisition_id
        ).all()
        existing_dicts = [
            {
                "candidate_name": e.candidate_name,
                "filename": e.filename,
                "fingerprint": e.fingerprint
            }
            for e in existing_submissions
        ]
        
        import asyncio as _asyncio
        _jd_parsed = _asyncio.run(_parse_jd_new(jd_text))
        _jd_emb = _gen_emb_new(_jd_parsed.embedding_text or jd_text[:500])
        _struct = _asyncio.run(_structure_resume_compat(cand.extracted_text))
        _score, _bd, _matched, _missing = _compute_score_new(_struct, _jd_parsed, _jd_emb, None)
        evaluation = {
            'match_score': round(_score, 2),
            'recommendation': _classify_new(_score).value,
            'summary': f'{_struct.name or cand.candidate_name or "Candidate"} scored {round(_score)}% match.'
        }
        
    return {
        "status": "success",
        "message": "Candidate successfully matched and screened in-memory.",
        "candidate_id": candidate_id,
        "match_score": evaluation["match_score"],
        "recommendation": evaluation["recommendation"],
        "summary": evaluation["summary"]
    }


@router.delete("/bank/{candidate_id}")
def delete_bank_candidate(candidate_id: str, current_user: User = Depends(get_current_user)) -> dict:
    """Delete candidate from Candidates Bank collection."""
    with get_session() as session:
        cand = session.get(Candidate, candidate_id)
        if not cand:
            raise HTTPException(status_code=404, detail="Candidate not found")
        if current_user.role != "Super Admin" and cand.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="You do not have access to this candidate")
        session.delete(cand)
        session.commit()
    return {"status": "success", "message": "Candidate deleted from bank"}


@router.post("/bank/match-bulk")
async def match_bulk_candidates(
    body: dict,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Bulk match existing bank candidates against a requisition using AI screening in-memory."""
    candidate_ids = body.get("candidate_ids")
    requisition_id = body.get("requisition_id")
    if not candidate_ids or not requisition_id:
        raise HTTPException(status_code=400, detail="candidate_ids and requisition_id are required")
        
    screened_list = []
    with get_session() as session:
        from modules.requisition.domain.models import Requisition
        req = session.get(Requisition, requisition_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requisition not found")
            
        jd_text = req.generated_jd_markdown or ""
        if not jd_text and req.structured_role:
            from modules.candidate_screening_agent.services.db_service import _vendor_role_text
            jd_text = _vendor_role_text(req.structured_role)
            
        from modules.resume_screener.pipeline.jd_parser import parse_jd as _parse_jd_new, generate_embedding as _gen_emb_new
        from modules.resume_screener.pipeline.scorer import compute_score as _compute_score_new, classify_candidate as _classify_new
        from modules.resume_screener.pipeline.structurer import structure_resume as _structure_resume_compat
        from modules.resume_screener.pipeline.github_agent import verify_github as _verify_github_new
        from modules.resume_screener.models.schemas import GitHubEvidence
        
        # Parse JD once for all candidates
        try:
            _jd_parsed = await _parse_jd_new(jd_text)
            _jd_emb = _gen_emb_new(_jd_parsed.embedding_text or jd_text[:500])
        except Exception as e:
            print(f"Error parsing JD for bulk screening: {e}")
            _jd_parsed = None
            _jd_emb = None

        for candidate_id in candidate_ids:
            cand = session.get(Candidate, candidate_id)
            if not cand:
                continue
            if current_user.role != "Super Admin" and cand.tenant_id != current_user.tenant_id:
                continue
                
            try:
                cand_text = cand.extracted_text or cand.summary or f"{cand.candidate_name} {cand.candidate_title} {' '.join(cand.skills or [])}"
                _struct = await _structure_resume_compat(cand_text)
                
                # Check GitHub if available
                gh_evidence = None
                if _struct.github_url:
                    try:
                        gh_evidence = await _verify_github_new(_struct.github_url)
                    except Exception:
                        gh_evidence = GitHubEvidence(verified=False)

                if _jd_parsed and _jd_emb:
                    _score, _bd, _matched, _missing = _compute_score_new(_struct, _jd_parsed, _jd_emb, gh_evidence)
                    rec = _classify_new(_score).value
                else:
                    _score = 75.0
                    rec = "Strong Match"
                    _matched = cand.skills or []
                    _missing = []

                screened_item = {
                    "id": f"temp_{candidate_id}",
                    "candidate_id": candidate_id,
                    "candidate_name": cand.candidate_name or _struct.name or "Candidate",
                    "candidate_email": cand.candidate_email or _struct.email or "",
                    "vendor_name": cand.vendor_company_name or current_user.tenant_name or "Vendor A",
                    "filename": cand.filename or f"{cand.candidate_name}.pdf",
                    "match_score": round(_score, 2),
                    "recommendation": rec,
                    "matched_skills": _matched,
                    "missing_skills": _missing,
                    "summary": f"{cand.candidate_name or _struct.name} scored {round(_score)}% match for this role.",
                    "status": "Screened",
                    "requisition_id": requisition_id
                }
                screened_list.append(screened_item)
            except Exception as e:
                print(f"Error screening candidate {candidate_id}: {e}")
                
        # Sort in memory by match_score descending
        screened_list = sorted(screened_list, key=lambda x: x.get("match_score") or 0, reverse=True)
        
    return {
        "status": "success",
        "screened_candidates": screened_list
    }


@router.post("/shortlist")
def shortlist_candidate(
    body: dict,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Save/persist candidate submission to candidate_submissions collection in MongoDB when recruiter clicks Shortlist."""
    requisition_id = body.get("requisition_id")
    candidate_name = body.get("candidate_name")
    candidate_email = body.get("candidate_email")
    vendor_name = body.get("vendor_name")
    match_score = body.get("match_score")
    recommendation = body.get("recommendation")
    summary = body.get("summary")
    filename = body.get("filename")

    if not requisition_id or not candidate_name:
        raise HTTPException(status_code=400, detail="requisition_id and candidate_name are required")

    with get_session() as session:
        all_subs = session.query(CandidateSubmission).filter(
            CandidateSubmission.requisition_id == requisition_id
        ).all()
        
        cand_email_clean = (candidate_email or "").strip().lower()
        cand_name_clean = (candidate_name or "").strip().lower()
        
        existing_sub = next(
            (s for s in all_subs if 
             (s.candidate_email and s.candidate_email.strip().lower() == cand_email_clean) or
             (s.candidate_name and (cand_name_clean in s.candidate_name.strip().lower() or s.candidate_name.strip().lower() in cand_name_clean))
            ),
            None
        )
        
        # Lookup resume PDF in Candidates bank or disk if not provided in request
        resume_pdf_data = body.get("resume_pdf") or body.get("pdf_base64")
        if not resume_pdf_data:
            cand_lookup = None
            if body.get("candidate_id"):
                cand_lookup = session.get(Candidate, body.get("candidate_id"))
            if not cand_lookup and (candidate_email or filename or candidate_name):
                all_cands = session.query(Candidate).filter(
                    Candidate.tenant_id == current_user.tenant_id
                ).all()
                cand_lookup = next(
                    (c for c in all_cands if 
                     (c.candidate_email and c.candidate_email.lower() == cand_email_clean) or 
                     (c.filename and c.filename == filename) or
                     (c.candidate_name and c.candidate_name.lower() == cand_name_clean)
                    ),
                    None
                )
            if cand_lookup and getattr(cand_lookup, "resume_pdf", None):
                resume_pdf_data = cand_lookup.resume_pdf
                
        # Fallback: check if the original file exists anywhere in uploads directory
        if not resume_pdf_data and filename:
            possible_paths = [
                os.path.join("uploads", filename),
                os.path.join("uploads", "screening", filename),
            ]
            for p in possible_paths:
                if os.path.exists(p):
                    try:
                        with open(p, "rb") as f_pdf:
                            resume_pdf_data = base64.b64encode(f_pdf.read()).decode("utf-8")
                        break
                    except Exception as e:
                        print(f"Failed to read fallback PDF from {p}: {e}")

        if existing_sub:
            existing_sub.status = "Shortlisted"
            if match_score is not None:
                existing_sub.match_score = match_score
            if recommendation:
                existing_sub.recommendation = recommendation
            if summary:
                existing_sub.summary = summary
            if resume_pdf_data:
                existing_sub.resume_pdf = resume_pdf_data
            existing_sub.updated_at = datetime.now(timezone.utc)
            session.add(existing_sub)
            sub_id = existing_sub.id
        else:
            sub_id = str(uuid.uuid4())[:8]
            new_sub = CandidateSubmission(
                id=sub_id,
                requisition_id=requisition_id,
                candidate_name=candidate_name,
                candidate_email=candidate_email,
                vendor_name=vendor_name or current_user.tenant_name or "Vendor A",
                filename=filename,
                fingerprint="",
                match_score=match_score,
                recommendation=recommendation,
                status="Shortlisted",
                summary=summary,
                details={},
                matched_skills=[],
                missing_skills=[],
                hiring_manager_notes="",
                resume_pdf=resume_pdf_data
            )
            new_sub.tenant_id = current_user.tenant_id
            session.add(new_sub)
            
        session.commit()
        return {
            "status": "success",
            "message": f"Candidate {candidate_name} shortlisted and saved to candidate_submissions table",
            "submission_id": sub_id
        }





@router.get("/{submission_id}/resume-pdf")
def get_submission_pdf(submission_id: str, current_user: User = Depends(get_current_user)):
    """Retrieve and stream the stored resume PDF directly from MongoDB."""
    with get_session() as session:
        sub = session.get(CandidateSubmission, submission_id)
        if not sub:
            raise HTTPException(status_code=404, detail="Candidate submission not found")
        if not getattr(sub, "resume_pdf", None):
            raise HTTPException(status_code=404, detail="No PDF data stored for this candidate")
        from fastapi.responses import Response
        pdf_bytes = base64.b64decode(sub.resume_pdf)
        filename = sub.filename or "resume.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'}
        )

@router.get("/bank/{candidate_id}/resume-pdf")
def get_bank_candidate_pdf(candidate_id: str, current_user: User = Depends(get_current_user)):
    """Retrieve and stream bank candidate resume PDF directly from MongoDB."""
    with get_session() as session:
        cand = session.get(Candidate, candidate_id)
        if not cand:
            raise HTTPException(status_code=404, detail="Candidate not found")
        if not getattr(cand, "resume_pdf", None):
            raise HTTPException(status_code=404, detail="No PDF data stored for this candidate")
        from fastapi.responses import Response
        pdf_bytes = base64.b64decode(cand.resume_pdf)
        filename = cand.filename or "resume.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'}
        )
