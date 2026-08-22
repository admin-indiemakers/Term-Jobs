import asyncio
import base64
"""FastAPI router exposing candidate submissions for the Hiring Manager UI."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, Response
import os
import shutil
import uuid
from datetime import datetime, timezone

from modules.candidate.domain.models import CandidateSubmission, Candidate
from modules.identity.domain.models import User
from modules.identity.router import get_current_user
from modules.notifications.services.notification_service import notify_candidate_shortlisted, notify_candidate_status
from modules.requisition.domain.models import CompanyProfile, Requisition
from modules.shared.db import get_session


router = APIRouter(prefix="/candidates", tags=["Candidates"])


def _make_candidate_id(session, requisition_id: str | None = None) -> str:
    """Generate a candidate ID prefixed with company initials (e.g. BEAR-a1b2c3d4)."""
    initials = "CND"
    if requisition_id:
        try:
            req = session.get(Requisition, requisition_id)
            if req and req.company_profile_id:
                company = session.get(CompanyProfile, req.company_profile_id)
                if company and company.name:
                    initials = company.name[:4].upper()
        except Exception:
            pass
    return f"{initials}-{str(uuid.uuid4())[:8]}"

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
        "submission_id": row.id,
        "requisition_id": row.requisition_id,
        "requisition_ref": f"REQ-{str(row.requisition_id)[:6].upper()}" if row.requisition_id else None,
        "requisition_title": req.title if req else None,
        "company_name": company.name if company else None,
        "candidate_name": row.candidate_name,
        "candidate_email": row.candidate_email,
        "vendor_name": row.vendor_name,
        "filename": row.filename,
        "resume_text": row.resume_text,
        "jd_text": getattr(row, "jd_text", None) or (req.generated_jd_markdown if req else None),
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
    """List candidate submissions with batched requisition & company lookups (eliminates N+1 DB overhead)."""
    with get_session() as session:
        filters = {}
        if status:
            filters["status"] = status
        if requisition_id:
            filters["requisition_id"] = requisition_id
            
        # Exclude heavy Base64 resume_pdf from bulk list queries
        docs = list(
            session._coll(CandidateSubmission)
            .find(filters, {"resume_pdf": 0})
            .sort([("match_score", -1), ("created_at", -1)])
        )
        
        # Batch load Requisitions and CompanyProfiles
        req_ids = list({d.get("requisition_id") for d in docs if d.get("requisition_id")})
        req_docs = list(session._coll(Requisition).find({"id": {"$in": req_ids}})) if req_ids else []
        reqs_map = {r.get("id"): r for r in req_docs}
        
        prof_ids = list({r.get("company_profile_id") for r in req_docs if r.get("company_profile_id")})
        prof_docs = list(session._coll(CompanyProfile).find({"id": {"$in": prof_ids}})) if prof_ids else []
        profs_map = {p.get("id"): p for p in prof_docs}
        
        if current_user.role != "Super Admin":
            tenant_req_ids = {r.get("id") for r in session._coll(Requisition).find({"tenant_id": current_user.tenant_id}, {"id": 1})}
            vendor_name = None
            if current_user.role == "Recruiter":
                from modules.identity.domain.models import Tenant
                t_doc = session._coll(Tenant).find_one({"id": current_user.tenant_id})
                vendor_name = (t_doc.get("name") or "").lower().strip() if t_doc else None
                
            docs = [
                d for d in docs
                if d.get("requisition_id") in tenant_req_ids
                or not d.get("requisition_id")
                or (vendor_name and d.get("vendor_name") and d.get("vendor_name").lower().strip() == vendor_name)
            ]
            
        results = []
        for d in docs:
            r_id = d.get("requisition_id")
            req = reqs_map.get(r_id)
            comp = profs_map.get(req.get("company_profile_id")) if req else None
            
            created_at = d.get("created_at")
            created_str = created_at.isoformat() if hasattr(created_at, 'isoformat') else str(created_at or "")
            
            results.append({
                "id": str(d.get("id") or d.get("_id")),
                "submission_id": str(d.get("id") or d.get("_id")),
                "requisition_id": r_id,
                "requisition_ref": f"REQ-{str(r_id)[:6].upper()}" if r_id else None,
                "requisition_title": req.get("title") if req else None,
                "company_name": comp.get("name") if comp else None,
                "candidate_name": d.get("candidate_name") or "",
                "candidate_email": d.get("candidate_email"),
                "vendor_name": d.get("vendor_name"),
                "filename": d.get("filename"),
                "resume_text": d.get("resume_text"),
                "jd_text": d.get("jd_text") or (req.get("generated_jd_markdown") if req else None),
                "match_score": float(d.get("match_score")) if d.get("match_score") is not None else None,
                "recommendation": d.get("recommendation"),
                "status": d.get("status") or "Screened",
                "summary": d.get("summary"),
                "matched_skills": d.get("matched_skills") or [],
                "missing_skills": d.get("missing_skills") or [],
                "hiring_manager_notes": d.get("hiring_manager_notes"),
                "created_at": created_str,
            })
            
        return results


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
                if c.requisition_id in tenant_reqs
                or not c.requisition_id
            ]
        return [_candidate_dict(session, row) for row in candidates]


@router.get("/bank")
def list_bank_candidates(current_user: User = Depends(get_current_user)) -> list[dict]:
    """Fetch candidates excluding heavy Base64 resume_pdf field for high-speed listing."""
    with get_session() as session:
        filters = {}
        if current_user.role != "Super Admin":
            filters = {"$or": [{"tenant_id": current_user.tenant_id}, {"tenant_id": None}, {"tenant_id": ""}]}
        
        # High-performance projection: omits heavy Base64 binary field
        docs = list(
            session._coll(Candidate)
            .find(filters, {"resume_pdf": 0})
            .sort("created_at", -1)
        )
        return [
            {
                "id": str(d.get("id") or d.get("_id")),
                "candidate_name": d.get("candidate_name") or "",
                "candidate_title": d.get("candidate_title") or "",
                "candidate_email": d.get("candidate_email"),
                "candidate_phone": d.get("candidate_phone"),
                "vendor_company_name": d.get("vendor_company_name") or "bridgeon",
                "skills": d.get("skills") or [],
                "filename": d.get("filename"),
                "summary": d.get("summary") or "",
                "created_at": d.get("created_at").isoformat() if hasattr(d.get("created_at"), 'isoformat') else str(d.get("created_at") or ""),
                "details": d.get("details") or {},
                "extracted_text": d.get("extracted_text") or ""
            }
            for d in docs
        ]


@router.get("/{candidate_id}/resume")
def get_candidate_resume(candidate_id: str, current_user: User = Depends(get_current_user)):
    """Serve the resume PDF for a candidate directly from MongoDB or storage."""
    from fastapi.responses import Response
    with get_session() as session:
        row = session.get(CandidateSubmission, candidate_id)
        if row is None:
            # Also check Candidate Bank collection
            cand_alt = session.get(Candidate, candidate_id)
            if cand_alt and getattr(cand_alt, "resume_pdf", None):
                pdf_bytes = base64.b64decode(cand_alt.resume_pdf)
                return Response(
                    content=pdf_bytes,
                    media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{cand_alt.filename or "resume.pdf"}"'}
                )
            raise HTTPException(status_code=404, detail="candidate not found")

        if current_user.role != "Super Admin":
            tenant_reqs = _tenant_requisition_ids(session, current_user.tenant_id)
            if row.requisition_id not in tenant_reqs:
                raise HTTPException(
                    status_code=403,
                    detail="You do not have access to this candidate",
                )

        # 1. Primary: Stream from MongoDB Base64 stored field
        if getattr(row, "resume_pdf", None):
            try:
                pdf_bytes = base64.b64decode(row.resume_pdf)
                return Response(
                    content=pdf_bytes,
                    media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{row.filename or "resume.pdf"}"'}
                )
            except Exception as e:
                print(f"Error decoding resume_pdf from DB: {e}")

        # 2. Check Candidate Bank for matching candidate
        cand_bank = session.query(Candidate).filter(
            Candidate.tenant_id == current_user.tenant_id,
            (Candidate.filename == row.filename) | 
            (Candidate.candidate_email == row.candidate_email)
        ).first()
        if cand_bank and getattr(cand_bank, "resume_pdf", None):
            try:
                pdf_bytes = base64.b64decode(cand_bank.resume_pdf)
                return Response(
                    content=pdf_bytes,
                    media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{row.filename or "resume.pdf"}"'}
                )
            except Exception as e:
                print(f"Error decoding candidate bank resume_pdf: {e}")

        if not row.filename:
            raise HTTPException(status_code=404, detail="No resume file stored for this candidate")

        # 3. Disk fallback (for local development only)
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

    # Notify the opposite party: company actions reach the vendor recruiters,
    # recruiter shortlist actions reach the company side.
    try:
        vendor_tenant_id = getattr(sub, "tenant_id", None) or ""
        is_company_actor = current_user.role in ("Admin", "HR", "Hiring Manager", "Director")
        if is_company_actor:
            notify_candidate_status(
                requisition_id=sub.requisition_id,
                candidate_name=sub.candidate_name,
                new_status=new_status,
                vendor_tenant_id=vendor_tenant_id,
                match_score=sub.match_score,
            )
        elif new_status == "Shortlisted":
            notify_candidate_shortlisted(
                requisition_id=sub.requisition_id,
                candidate_name=sub.candidate_name,
                vendor_name=current_user.tenant_name or sub.vendor_name or "Vendor A",
                match_score=sub.match_score,
            )
    except Exception:  # noqa: BLE001
        pass

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
    """Add candidates to candidate bank via AI multi-resume parsing (Groq LLM) or manual form entry."""
    import tempfile
    import asyncio
    from modules.resume_screener.pipeline.extractor import extract_text as _extract_text_new
    from modules.candidate.extractor import extract_candidate_profile
    
    vendor_company = vendor_company_name or getattr(current_user, "tenant_name", None) or "bridgeon"
    saved_candidates = []
    
    # Filter valid files if provided
    valid_files = [f for f in (files or []) if f and f.filename]
    
    with get_session() as session:
        if valid_files:
            with tempfile.TemporaryDirectory() as temp_dir_str:
                sem = asyncio.Semaphore(5)  # Process up to 5 resumes concurrently
                
                async def process_file(file: UploadFile):
                    async with sem:
                        file_path = os.path.join(temp_dir_str, file.filename)
                        content = await file.read()
                        with open(file_path, "wb") as buffer:
                            buffer.write(content)
                        
                        pdf_base64_data = base64.b64encode(content).decode("utf-8")
                        file_type = "docx" if file.filename.lower().endswith(".docx") else "pdf"
                        
                        try:
                            extracted_text = _extract_text_new(file_path, file_type)
                        except Exception as ex:
                            print(f"Text extraction failed for {file.filename}: {ex}")
                            extracted_text = ""
                            
                        # Use Groq LLM candidate profile extractor
                        profile = await extract_candidate_profile(extracted_text, file.filename)
                        
                        # Apply manual overrides if explicitly provided (for single upload)
                        final_name = (name if len(valid_files) == 1 and name else None) or profile.get("candidate_name") or "Candidate"
                        final_email = (email if len(valid_files) == 1 and email else None) or profile.get("candidate_email")
                        final_phone = (phone if len(valid_files) == 1 and phone else None) or profile.get("candidate_phone")
                        final_title = (candidate_title if len(valid_files) == 1 and candidate_title else None) or profile.get("candidate_title") or "Software Engineer"
                        final_vendor = vendor_company
                        
                        return {
                            "filename": file.filename,
                            "name": final_name,
                            "email": final_email,
                            "phone": final_phone,
                            "title": final_title,
                            "vendor": final_vendor,
                            "skills": profile.get("skills") or [],
                            "summary": profile.get("summary") or "",
                            "extracted_text": extracted_text,
                            "resume_pdf": pdf_base64_data,
                            "details": {"experience_years": profile.get("experience_years")}
                        }
                
                extracted_results = await asyncio.gather(*[process_file(f) for f in valid_files], return_exceptions=True)
                
                for item in extracted_results:
                    if isinstance(item, Exception):
                        print(f"Error processing candidate file: {item}")
                        continue
                    
                    final_name = item["name"]
                    final_email = item["email"]
                    final_phone = item["phone"]
                    final_title = item["title"]
                    final_vendor = item["vendor"]
                    
                    # Upsert candidate in database
                    existing = None
                    if final_email:
                        existing = session.query(Candidate).filter(
                            Candidate.tenant_id == current_user.tenant_id,
                            Candidate.candidate_email == final_email
                        ).first()
                    if not existing and item["filename"]:
                        existing = session.query(Candidate).filter(
                            Candidate.tenant_id == current_user.tenant_id,
                            Candidate.filename == item["filename"]
                        ).first()
                        
                    if existing:
                        existing.candidate_name = final_name
                        existing.candidate_title = final_title
                        existing.candidate_email = final_email
                        existing.candidate_phone = final_phone
                        existing.skills = item["skills"]
                        existing.summary = item["summary"]
                        existing.vendor_company_name = final_vendor
                        existing.extracted_text = item["extracted_text"]
                        existing.resume_pdf = item["resume_pdf"]
                        existing.details = item["details"]
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
                            skills=item["skills"],
                            filename=item["filename"],
                            summary=item["summary"],
                            extracted_text=item["extracted_text"],
                            resume_pdf=item["resume_pdf"],
                            tenant_id=current_user.tenant_id,
                            details=item["details"]
                        )
                        session.add(new_candidate)
                        saved_candidates.append(new_candidate)
            
            # Persist all uploaded candidates to MongoDB
            session.commit()
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
                    summary="Manually registered candidate profile.",
                    extracted_text="",
                    resume_pdf=None,
                    tenant_id=current_user.tenant_id,
                    details={}
                )
                session.add(new_candidate)
                saved_candidates.append(new_candidate)
            
            # Persist manual candidate to MongoDB
            session.commit()

    return {
        "status": "success",
        "message": f"Successfully processed {len(saved_candidates)} candidate(s) to the Candidate Bank.",
        "count": len(saved_candidates),
        "candidates": [c.id for c in saved_candidates]
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
    """Bulk match existing bank candidates against a requisition using AI screening in-memory with parallel execution."""
    candidate_ids = body.get("candidate_ids")
    requisition_id = body.get("requisition_id")
    if not candidate_ids or not requisition_id:
        raise HTTPException(status_code=400, detail="candidate_ids and requisition_id are required")
        
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

        # Fetch candidate entities
        candidates = []
        for candidate_id in candidate_ids:
            cand = session.get(Candidate, candidate_id)
            if cand:
                candidates.append(cand)

    async def screen_single_candidate(cand):
        try:
            cand_text = cand.extracted_text or cand.summary or f"{cand.candidate_name} {cand.candidate_title} {' '.join(cand.skills or [])}"
            _struct = await _structure_resume_compat(cand_text)
            
            # Check GitHub if available with 5s timeout
            gh_evidence = None
            if _struct.github_url:
                try:
                    gh_evidence = await asyncio.wait_for(_verify_github_new(_struct.github_url), timeout=5.0)
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

            c_name = cand.candidate_name or getattr(_struct, 'name', '') or "Candidate"
            c_email = cand.candidate_email or getattr(_struct, 'email', '') or ""
            v_name = cand.vendor_company_name or getattr(current_user, 'tenant_name', None) or getattr(current_user, 'name', 'Agency') or "Vendor Agency"

            return {
                "id": f"temp_{cand.id}",
                "candidate_id": cand.id,
                "candidate_name": c_name,
                "candidate_email": c_email,
                "vendor_name": v_name,
                "filename": cand.filename or f"{c_name}.pdf",
                "match_score": round(_score, 2),
                "recommendation": rec,
                "matched_skills": _matched or [],
                "missing_skills": _missing or [],
                "summary": f"{c_name} scored {round(_score)}% match for this role.",
                "status": "Screened",
                "requisition_id": requisition_id
            }
        except Exception as e:
            print(f"Error screening candidate {cand.id}: {e}")
            return None

    # Parallel processing of all candidates with Groq + GitHub
    results = await asyncio.gather(*(screen_single_candidate(c) for c in candidates))
    screened_list = [r for r in results if r is not None]
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
            sub_id = _make_candidate_id(session, requisition_id)
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
        notify_candidate_shortlisted(
            requisition_id=requisition_id,
            candidate_name=candidate_name,
            vendor_name=vendor_name or current_user.tenant_name or "Vendor A",
            match_score=match_score,
        )
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
