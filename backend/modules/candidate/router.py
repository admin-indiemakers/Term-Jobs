import asyncio
import base64
"""FastAPI router exposing candidate submissions for the Hiring Manager UI."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, Response
import os
import shutil
import uuid
from datetime import datetime, timezone

from modules.candidate.domain.models import CandidateSubmission, Candidate, ScreeningCache
from modules.identity.domain.models import User, Tenant
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
    if req and getattr(req, "company_profile_id", None):
        company = session.get(CompanyProfile, req.company_profile_id)
    
    comp_name = None
    if company and getattr(company, "name", None):
        comp_name = company.name
    elif req and getattr(req, "tenant_id", None):
        tenant_obj = session.get(Tenant, req.tenant_id)
        if tenant_obj and getattr(tenant_obj, "name", None):
            comp_name = tenant_obj.name
    if not comp_name and req:
        comp_name = getattr(req, "company_name", None) or getattr(req, "client_name", None)
    if not comp_name:
        comp_name = ""

    req_title = (getattr(req, "title", None) if req else None) or ""
    hm_name = (req.structured_role or {}).get("hiring_manager") if req else ""
    details = row.details or {}
    return {
        "id": row.id,
        "submission_id": row.id,
        "requisition_id": row.requisition_id,
        "requisition_ref": f"REQ-{str(row.requisition_id)[:6].upper()}" if row.requisition_id else None,
        "requisition_title": req_title,
        "company_name": comp_name,
        "hiring_manager_name": hm_name or "",
        "candidate_name": row.candidate_name,
        "candidate_email": row.candidate_email,
        "candidate_phone": details.get("candidate_phone") or getattr(row, "candidate_phone", "") or "",
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
        "breakdown": details.get("breakdown") or {},
        "github_evidence": details.get("github_evidence"),
        "github_url": details.get("github_url"),
        "linkedin_url": details.get("linkedin_url"),
        "projects": details.get("projects") or [],
        "experience": details.get("experience") or [],
        "education": details.get("education") or [],
        "certifications": details.get("certifications") or [],
        "skills": details.get("skills") or row.matched_skills or [],
        "hiring_manager_notes": row.hiring_manager_notes,
        "created_at": row.created_at.isoformat() if hasattr(row.created_at, 'isoformat') else str(row.created_at or ''),
    }


def _fetch_candidate_submissions_mongo(query_filter: dict, current_user: User) -> list[dict]:
    """Query candidate submissions directly from MongoDB with caching and permissions."""
    from modules.shared.db import db
    if current_user.role != "Super Admin" and current_user.tenant_id:
        from modules.identity.domain.models import Tenant
        with get_session() as session:
            tenant_reqs = list(_tenant_requisition_ids(session, current_user.tenant_id))
            tenant = session.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
            vendor_name = (tenant.name or "").lower().strip() if tenant else None

        or_conditions = [
            {"tenant_id": current_user.tenant_id},
            {"tenant_id": None},
            {"tenant_id": ""},
        ]
        if tenant_reqs:
            or_conditions.append({"requisition_id": {"$in": tenant_reqs}})
        if vendor_name:
            or_conditions.append({"vendor_name": {"$regex": f"^{vendor_name}$", "$options": "i"}})
        
        if "$or" in query_filter:
            query_filter = {"$and": [query_filter, {"$or": or_conditions}]}
        else:
            query_filter["$or"] = or_conditions

    projection = {"resume_pdf": 0}
    cursor = db["candidate_submissions"].find(query_filter, projection).sort([("match_score", -1), ("created_at", -1)])

    all_docs = list(cursor)
    # Pre-cache requisitions and companies
    req_ids = list({doc.get("requisition_id") for doc in all_docs if doc.get("requisition_id")})
    req_cache = {}
    if req_ids:
        for rd in db["requisitions"].find({"id": {"$in": req_ids}}):
            req_cache[rd.get("id")] = rd

    comp_ids = list({r.get("company_profile_id") or r.get("company_id") for r in req_cache.values() if r.get("company_profile_id") or r.get("company_id")})
    comp_cache = {}
    if comp_ids:
        for cd in db["company_profiles"].find({"id": {"$in": comp_ids}}):
            comp_cache[cd.get("id")] = cd.get("name")

    results = []
    for doc in all_docs:
        req_id = doc.get("requisition_id")
        req_doc = req_cache.get(req_id, {})
        req_title = req_doc.get("title") or ""
        comp_id = req_doc.get("company_profile_id") or req_doc.get("company_id")
        comp_name = comp_cache.get(comp_id) or req_doc.get("company_name") or req_doc.get("client_name") or ""
        
        details = doc.get("details") or {}
        created_val = doc.get("created_at")
        hm_name = (req_doc.get("structured_role") or {}).get("hiring_manager") or ""
        results.append({
            "id": doc.get("id"),
            "submission_id": doc.get("id"),
            "requisition_id": req_id,
            "requisition_ref": f"REQ-{str(req_id)[:6].upper()}" if req_id else None,
            "requisition_title": req_title,
            "company_name": comp_name,
            "hiring_manager_name": hm_name,
            "candidate_name": doc.get("candidate_name"),
            "candidate_email": doc.get("candidate_email"),
            "candidate_phone": details.get("candidate_phone") or doc.get("candidate_phone") or "",
            "vendor_name": doc.get("vendor_name") or "bridgeon",
            "filename": doc.get("filename"),
            "resume_text": doc.get("resume_text"),
            "jd_text": doc.get("jd_text") or req_doc.get("generated_jd_markdown") or "",
            "match_score": float(doc.get("match_score")) if doc.get("match_score") is not None else None,
            "recommendation": doc.get("recommendation"),
            "status": doc.get("status"),
            "summary": doc.get("summary"),
            "matched_skills": doc.get("matched_skills") or [],
            "missing_skills": doc.get("missing_skills") or [],
            "breakdown": details.get("breakdown") or {},
            "github_evidence": details.get("github_evidence"),
            "github_url": details.get("github_url"),
            "linkedin_url": details.get("linkedin_url"),
            "projects": details.get("projects") or [],
            "experience": details.get("experience") or [],
            "education": details.get("education") or [],
            "certifications": details.get("certifications") or [],
            "skills": details.get("skills") or doc.get("matched_skills") or [],
            "hiring_manager_notes": doc.get("hiring_manager_notes"),
            "created_at": created_val.isoformat() if hasattr(created_val, "isoformat") else str(created_val or ""),
        })
    return results


@router.get("")
def list_candidates(
    status: str | None = None,
    requisition_id: str | None = None,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List candidate submissions, optionally filtered by status and/or requisition."""
    query_filter = {}
    if status:
        query_filter["status"] = status
    if requisition_id:
        query_filter["requisition_id"] = requisition_id
    return _fetch_candidate_submissions_mongo(query_filter, current_user)


@router.get("/shortlisted")
def list_shortlisted(current_user: User = Depends(get_current_user)) -> list[dict]:
    """Shortcut for the shortlisted candidates queue (optimized direct Mongo query)."""
    if current_user.role in ("Recruiter", "Vendor"):
        return _fetch_candidate_submissions_mongo({"status": {"$in": ["Shortlisted", "Accepted", "Under Review", "Hired"]}}, current_user)
    return _fetch_candidate_submissions_mongo({"status": "Shortlisted"}, current_user)


@router.get("/bank")
def list_bank_candidates(current_user: User = Depends(get_current_user)) -> list[dict]:
    """Fetch all candidates stored in the candidates collection for this tenant/vendor."""
    from modules.shared.db import db
    query_filter = {}
    if current_user.role != "Super Admin" and current_user.tenant_id:
        query_filter = {"$or": [{"tenant_id": None}, {"tenant_id": current_user.tenant_id}, {"tenant_id": ""}]}
    
    projection = {"resume_pdf": 0, "extracted_text": 0}
    cursor = db["candidates"].find(query_filter, projection).sort("created_at", -1)
    results = []
    for c in cursor:
        created_val = c.get("created_at")
        results.append({
            "id": c.get("id") or str(c.get("_id")),
            "candidate_name": c.get("candidate_name") or "",
            "candidate_title": c.get("candidate_title") or "",
            "candidate_email": c.get("candidate_email") or "",
            "candidate_phone": c.get("candidate_phone") or "",
            "vendor_company_name": c.get("vendor_company_name") or "",
            "skills": c.get("skills") or [],
            "filename": c.get("filename") or "",
            "summary": c.get("summary") or "",
            "created_at": created_val.isoformat() if hasattr(created_val, "isoformat") else (str(created_val) if created_val else None),
            "details": c.get("details") or {},
        })
    return results


@router.get("/bank/{candidate_id}/resume-pdf")
@router.get("/bank/{candidate_id}/resume")
@router.get("/{candidate_id}/resume-pdf")
@router.get("/{candidate_id}/resume")
def get_candidate_resume(candidate_id: str, current_user: User = Depends(get_current_user)):
    """Serve the resume PDF for a candidate directly from MongoDB (candidate_submissions or candidates bank)."""
    from fastapi.responses import Response
    from modules.shared.db import db
    from bson import ObjectId

    doc = None
    # 1. Look in candidate_submissions by string ID
    doc = db["candidate_submissions"].find_one({"id": candidate_id})
    if not doc:
        try:
            doc = db["candidate_submissions"].find_one({"_id": ObjectId(candidate_id)})
        except Exception:
            pass

    # 2. Look in candidates (Candidate Bank)
    if not doc or not doc.get("resume_pdf"):
        bank_doc = db["candidates"].find_one({"id": candidate_id})
        if not bank_doc:
            try:
                bank_doc = db["candidates"].find_one({"_id": ObjectId(candidate_id)})
            except Exception:
                pass
        if bank_doc and bank_doc.get("resume_pdf"):
            doc = bank_doc

    # 3. If still not found by ID, look up by candidate name or email if matched in submission
    if doc and not doc.get("resume_pdf"):
        cand_email = doc.get("candidate_email")
        cand_name = doc.get("candidate_name")
        match_q = []
        if cand_email:
            match_q.append({"candidate_email": cand_email})
        if cand_name:
            match_q.append({"candidate_name": cand_name})
        if match_q:
            alt_doc = db["candidates"].find_one({"$or": match_q, "resume_pdf": {"$exists": True, "$ne": None}})
            if alt_doc and alt_doc.get("resume_pdf"):
                doc = alt_doc

    if doc and doc.get("resume_pdf"):
        try:
            pdf_bytes = base64.b64decode(doc["resume_pdf"])
            filename = doc.get("filename") or f"{doc.get('candidate_name', 'resume')}.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'inline; filename="{filename}"',
                    "Content-Type": "application/pdf",
                }
            )
        except Exception as e:
            logger.error(f"Error decoding resume_pdf from DB for {candidate_id}: {e}")

    # 4. Disk fallback (for local development)
    if doc and doc.get("filename"):
        fname = doc.get("filename")
        for directory in RESUME_UPLOAD_DIRS:
            if not directory:
                continue
            path = os.path.join(directory, fname)
            if os.path.exists(path):
                return FileResponse(
                    path,
                    media_type="application/pdf",
                    filename=fname,
                )

    raise HTTPException(status_code=404, detail="Resume PDF not found for this candidate")


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

    # Sync status change to MongoDB candidate_submissions
    try:
        from modules.shared.db import db
        db["candidate_submissions"].update_one(
            {"id": submission_id},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    except Exception as mongo_err:
        print(f"Failed to sync status update to MongoDB: {mongo_err}")

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


@router.get("/bank/screened-summary")
def get_screened_summary(
    current_user: User = Depends(get_current_user)
) -> dict:
    """Return a map of all requisitions screened by the current recruiter (from both active cache & submissions)."""
    with get_session() as session:
        now = datetime.now(timezone.utc)
        summary_map = {}

        # 1. From temporary active screening cache
        active_caches = (
            session.query(ScreeningCache)
            .filter(ScreeningCache.recruiter_id == current_user.id)
            .order_by(ScreeningCache.created_at.desc())
            .all()
        )
        for cache_doc in active_caches:
            exp = cache_doc.expires_at
            is_active = (exp > now) if (exp and exp.tzinfo) else (exp > datetime.utcnow()) if exp else False
            if is_active and cache_doc.requisition_id and cache_doc.results:
                req_id = cache_doc.requisition_id
                if req_id not in summary_map:
                    summary_map[req_id] = {
                        "screened_count": len(cache_doc.results),
                        "has_cache": True,
                        "latest_screened_at": cache_doc.created_at.isoformat() if cache_doc.created_at else None
                    }

        # 2. From candidate submissions (permanent shortlisted)
        submissions = (
            session.query(CandidateSubmission)
            .all()
        )
        for sub in submissions:
            if sub.requisition_id:
                if sub.requisition_id not in summary_map:
                    summary_map[sub.requisition_id] = {
                        "screened_count": 1,
                        "has_cache": False,
                        "latest_screened_at": sub.created_at.isoformat() if sub.created_at else None
                    }

        # 3. From Mongo submissions
        from modules.shared.db import db
        for doc in db["candidate_submissions"].find({}, {"requisition_id": 1, "created_at": 1}):
            rid = doc.get("requisition_id")
            if rid and rid not in summary_map:
                summary_map[rid] = {
                    "screened_count": 1,
                    "has_cache": False,
                    "latest_screened_at": str(doc.get("created_at") or "")
                }

        return {
            "status": "success",
            "screened_requisitions": summary_map
        }


def _enrich_screened_with_live_status(session, requisition_id: str, candidates: list[dict]) -> list[dict]:
    """Enrich screened candidate cards with live submission status (Shortlisted, Accepted, Rejected) from database."""
    if not requisition_id or not candidates:
        return candidates
    subs = session.query(CandidateSubmission).filter(
        CandidateSubmission.requisition_id == requisition_id
    ).all()
    sub_map_email = {}
    sub_map_name = {}
    sub_map_sub_id = {}
    for s in subs:
        if s.candidate_email:
            sub_map_email[s.candidate_email.strip().lower()] = s
        if s.candidate_name:
            sub_map_name[s.candidate_name.strip().lower()] = s
        if s.id:
            sub_map_sub_id[str(s.id).strip().lower()] = s

    enriched = []
    for c in candidates:
        cand_dict = dict(c)
        email = (cand_dict.get("candidate_email") or cand_dict.get("email") or "").strip().lower()
        name = (cand_dict.get("candidate_name") or cand_dict.get("name") or "").strip().lower()
        cid = str(cand_dict.get("candidate_id") or cand_dict.get("id") or cand_dict.get("submission_id") or "").strip().lower()

        sub = sub_map_email.get(email) or sub_map_name.get(name) or sub_map_sub_id.get(cid)
        if sub:
            cand_dict["status"] = sub.status
            cand_dict["id"] = sub.id
            cand_dict["submission_id"] = sub.id
            if sub.vendor_name:
                cand_dict["vendor_name"] = sub.vendor_name
        enriched.append(cand_dict)
    return enriched


@router.get("/bank/screening-cache/{requisition_id}")
def get_screening_cache(
    requisition_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Retrieve temporary active screening cache for the current recruiter and requisition on page load."""
    with get_session() as session:
        now = datetime.now(timezone.utc)
        active_caches = (
            session.query(ScreeningCache)
            .filter(
                ScreeningCache.recruiter_id == current_user.id,
                ScreeningCache.requisition_id == requisition_id,
            )
            .order_by(ScreeningCache.created_at.desc())
            .all()
        )
        for cache_doc in active_caches:
            exp = cache_doc.expires_at
            is_active = (exp > now) if (exp and exp.tzinfo) else (exp > datetime.utcnow()) if exp else False
            if is_active and cache_doc.results:
                print(f"[SCREENING CACHE] Page load HIT requisition_id={requisition_id} candidate_count={len(cache_doc.results)}")
                enriched_results = _enrich_screened_with_live_status(session, requisition_id, cache_doc.results)
                return {
                    "status": "success",
                    "has_cache": True,
                    "source": "cache",
                    "cache_hit": True,
                    "screened_candidates": enriched_results
                }
        return {
            "status": "success",
            "has_cache": False,
            "source": "cache",
            "cache_hit": False,
            "screened_candidates": []
        }


@router.post("/bank/match-bulk")
async def match_bulk_candidates(
    body: dict,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Bulk match existing bank candidates against a requisition using AI screening with server-side MongoDB TTL caching."""
    import hashlib
    from datetime import timedelta
    candidate_ids = body.get("candidate_ids")
    requisition_id = body.get("requisition_id")
    if not candidate_ids or not requisition_id:
        raise HTTPException(status_code=400, detail="candidate_ids and requisition_id are required")
        
    sorted_ids = sorted(candidate_ids)
    cache_key_raw = f"{current_user.id}:{requisition_id}:{','.join(sorted_ids)}"
    exact_cache_key = hashlib.sha256(cache_key_raw.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    with get_session() as session:
        from modules.requisition.domain.models import Requisition
        req = session.get(Requisition, requisition_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requisition not found")

        # 1. Exact Cache Key Match Check
        exact_cache = session.query(ScreeningCache).filter(
            ScreeningCache.cache_key == exact_cache_key
        ).first()

        exp = exact_cache.expires_at if exact_cache else None
        is_active = (exp > now) if (exp and exp.tzinfo) else (exp > datetime.utcnow()) if exp else False
        if is_active and exact_cache.results:
            print(f"[SCREENING CACHE] HIT requisition_id={requisition_id} candidate_count={len(exact_cache.results)}")
            enriched_results = _enrich_screened_with_live_status(session, requisition_id, exact_cache.results)
            return {
                "status": "success",
                "source": "cache",
                "cache_hit": True,
                "screened_candidates": enriched_results
            }

        # 2. Check Candidate-Level Partial Cache Hits
        active_caches = session.query(ScreeningCache).filter(
            ScreeningCache.recruiter_id == current_user.id,
            ScreeningCache.requisition_id == requisition_id,
        ).all()

        cached_candidate_map = {}
        for cdoc in active_caches:
            exp = cdoc.expires_at
            is_active = (exp > now) if (exp and exp.tzinfo) else (exp > datetime.utcnow()) if exp else False
            if is_active and cdoc.results:
                for res in cdoc.results:
                    cid = res.get("candidate_id") or (res.get("id") or "").replace("temp_", "")
                    if cid and cid not in cached_candidate_map:
                        cached_candidate_map[cid] = res

        reused_results = []
        missing_candidate_ids = []
        for cid in candidate_ids:
            if cid in cached_candidate_map:
                reused_results.append(cached_candidate_map[cid])
            else:
                missing_candidate_ids.append(cid)

        if not missing_candidate_ids and reused_results:
            print(f"[SCREENING CACHE] HIT (Candidate-level) requisition_id={requisition_id} candidate_count={len(reused_results)}")
            expires_at = now + timedelta(hours=24)
            cache_entry = ScreeningCache(
                cache_key=exact_cache_key,
                recruiter_id=current_user.id,
                tenant_id=current_user.tenant_id,
                requisition_id=requisition_id,
                candidate_ids=candidate_ids,
                results=reused_results,
                created_at=now,
                expires_at=expires_at,
            )
            session.add(cache_entry)
            session.commit()
            return {
                "status": "success",
                "source": "cache",
                "cache_hit": True,
                "screened_candidates": reused_results
            }

        if reused_results:
            print(f"[SCREENING CACHE] MISS (Partial) requisition_id={requisition_id} new_candidates={len(missing_candidate_ids)} cached_candidates={len(reused_results)}")
        else:
            print(f"[SCREENING CACHE] MISS requisition_id={requisition_id} candidate_count={len(missing_candidate_ids)}")

        print(f"[SCREENING] Running AI screening for {len(missing_candidate_ids)} candidates")

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
        for candidate_id in missing_candidate_ids:
            cand = session.get(Candidate, candidate_id)
            if cand:
                candidates.append(cand)

        async def screen_single_candidate(cand):
            try:
                import re
                cand_text = cand.extracted_text or cand.summary or f"{cand.candidate_name} {cand.candidate_title} {' '.join(cand.skills or [])}"
                _struct = await _structure_resume_compat(cand_text)
                
                # Extract GitHub and LinkedIn URLs
                gh_url = getattr(_struct, 'github_url', None)
                if not gh_url or 'github.com' not in gh_url.lower():
                    gh_match = re.search(r'(https?://(?:www\.)?github\.com/[a-zA-Z0-9_\-]+|github\.com/[a-zA-Z0-9_\-]+)', cand_text, re.IGNORECASE)
                    if gh_match:
                        gh_url = gh_match.group(0)
                if gh_url and not gh_url.startswith('http'):
                    gh_url = 'https://' + gh_url

                li_url = getattr(_struct, 'linkedin_url', None)
                if not li_url or 'linkedin.com' not in li_url.lower():
                    li_match = re.search(r'(https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_\-]+|linkedin\.com/in/[a-zA-Z0-9_\-]+)', cand_text, re.IGNORECASE)
                    if li_match:
                        li_url = li_match.group(0)
                if li_url and not li_url.startswith('http'):
                    li_url = 'https://' + li_url

                # Extract Phone
                c_phone = cand.candidate_phone or ""
                if not c_phone:
                    ph_match = re.search(r'(\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5})', cand_text)
                    if ph_match and len(ph_match.group(0).strip()) >= 10:
                        c_phone = ph_match.group(0).strip()

                # Verify GitHub live
                gh_evidence = None
                if gh_url:
                    try:
                        gh_evidence = await asyncio.wait_for(_verify_github_new(gh_url), timeout=8.0)
                    except Exception:
                        gh_evidence = GitHubEvidence(verified=False, profile_url=gh_url, username=gh_url.split('/')[-1])

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

                bd_dict = {}
                if _bd:
                    if hasattr(_bd, "model_dump"):
                        bd_dict = _bd.model_dump()
                    elif hasattr(_bd, "dict"):
                        bd_dict = _bd.dict()
                    elif isinstance(_bd, dict):
                        bd_dict = _bd

                gh_dict = None
                if gh_evidence:
                    gh_dict = gh_evidence.model_dump() if hasattr(gh_evidence, "model_dump") else gh_evidence.dict() if hasattr(gh_evidence, "dict") else {}
                    if not gh_dict.get("profile_url") and gh_url:
                        gh_dict["profile_url"] = gh_url
                elif gh_url:
                    gh_dict = {"verified": False, "profile_url": gh_url, "username": gh_url.split('/')[-1], "top_repos": [], "verified_skills": []}

                # Extract projects, experience, education, certifications
                proj_items = [p.model_dump() if hasattr(p, "model_dump") else p.dict() if hasattr(p, "dict") else p for p in (_struct.projects or [])]
                exp_items = [e.model_dump() if hasattr(e, "model_dump") else e.dict() if hasattr(e, "dict") else e for e in (_struct.experience or [])]
                edu_items = [ed.model_dump() if hasattr(ed, "model_dump") else ed.dict() if hasattr(ed, "dict") else ed for ed in (_struct.education or [])]
                certs_items = _struct.certifications or []

                # If projects or experience are empty from structurer, synthesize from GitHub
                if not proj_items and gh_dict and gh_dict.get("top_repos"):
                    for r in gh_dict["top_repos"][:4]:
                        proj_items.append({
                            "name": r.get("name"),
                            "description": r.get("description") or f"Public GitHub repository by {c_name}",
                            "technologies": r.get("languages") or [],
                            "outcome": f"Available on GitHub: {r.get('url')}"
                        })

                return {
                    "id": f"temp_{cand.id}",
                    "candidate_id": cand.id,
                    "candidate_name": c_name,
                    "candidate_title": cand.candidate_title or getattr(_struct, 'role_title', '') or "",
                    "candidate_email": c_email,
                    "candidate_phone": c_phone,
                    "vendor_name": v_name,
                    "filename": cand.filename or f"{c_name}.pdf",
                    "match_score": round(_score, 2),
                    "recommendation": rec,
                    "matched_skills": _matched or [],
                    "missing_skills": _missing or [],
                    "breakdown": bd_dict,
                    "github_evidence": gh_dict,
                    "github_url": gh_url,
                    "linkedin_url": li_url,
                    "projects": proj_items,
                    "experience": exp_items,
                    "education": edu_items,
                    "certifications": certs_items,
                    "skills": cand.skills or getattr(_struct, 'skills', []) or [],
                    "summary": cand.summary or f"{c_name} scored {round(_score)}% match for this role.",
                    "extracted_text": cand.extracted_text or "",
                    "status": "Screened",
                    "requisition_id": requisition_id
                }
            except Exception as e:
                print(f"Error screening candidate {cand.id}: {e}")
                return None

        # Parallel processing of missing candidates with Groq + GitHub
        results = await asyncio.gather(*(screen_single_candidate(c) for c in candidates))
        newly_screened = [r for r in results if r is not None]
        all_screened = reused_results + newly_screened
        all_screened = sorted(all_screened, key=lambda x: x.get("match_score") or 0, reverse=True)

        # Save to screening_cache (never store resume_pdf in cache)
        expires_at = now + timedelta(hours=24)
        new_cache_entry = ScreeningCache(
            cache_key=exact_cache_key,
            recruiter_id=current_user.id,
            tenant_id=current_user.tenant_id,
            requisition_id=requisition_id,
            candidate_ids=candidate_ids,
            results=all_screened,
            created_at=now,
            expires_at=expires_at,
        )
        session.add(new_cache_entry)
        session.commit()

        print(f"[SCREENING CACHE] Saved {len(all_screened)} screening results expires_at={expires_at.isoformat()}")

        enriched_screened = _enrich_screened_with_live_status(session, requisition_id, all_screened)
        return {
            "status": "success",
            "source": "ai" if not reused_results else "hybrid",
            "cache_hit": False,
            "screened_candidates": enriched_screened
        }



@router.get("/shortlist-quota/{requisition_id}")
def get_shortlist_quota(
    requisition_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Return the candidate shortlist quota and current count for this vendor/requisition."""
    from modules.shared.settings import get_max_candidates_per_requisition
    from modules.identity.domain.models import VendorEngagement
    from modules.requisition.domain.models import Requisition

    limit = current_user.candidate_limit or get_max_candidates_per_requisition()
    with get_session() as session:
        req_obj = session.get(Requisition, requisition_id)
        if req_obj and req_obj.tenant_id and current_user.tenant_id:
            eng = session.query(VendorEngagement).filter(
                VendorEngagement.tenant_id == req_obj.tenant_id,
                VendorEngagement.vendor_tenant_id == current_user.tenant_id
            ).first()
            if eng and eng.candidate_limit is not None:
                limit = eng.candidate_limit

        all_subs = session.query(CandidateSubmission).filter(
            CandidateSubmission.requisition_id == requisition_id,
            CandidateSubmission.status.in_(["Shortlisted", "Accepted", "Under Review"])
        ).all()
        if current_user.tenant_id and current_user.role != "Super Admin":
            all_subs = [s for s in all_subs if s.tenant_id == current_user.tenant_id or (not s.tenant_id)]

        count = len(all_subs)
        return {
            "status": "success",
            "limit": limit,
            "used": count,
            "remaining": max(0, limit - count),
            "is_limit_reached": count >= limit
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

    from modules.shared.settings import get_max_candidates_per_requisition
    from modules.identity.domain.models import VendorEngagement
    from modules.requisition.domain.models import Requisition

    limit = current_user.candidate_limit or get_max_candidates_per_requisition()

    with get_session() as session:
        req_obj = session.get(Requisition, requisition_id)
        if req_obj and req_obj.tenant_id and current_user.tenant_id:
            eng = session.query(VendorEngagement).filter(
                VendorEngagement.tenant_id == req_obj.tenant_id,
                VendorEngagement.vendor_tenant_id == current_user.tenant_id
            ).first()
            if eng and eng.candidate_limit is not None:
                limit = eng.candidate_limit

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

        active_subs = [s for s in all_subs if s.status in ("Shortlisted", "Accepted", "Under Review")]
        if current_user.tenant_id and current_user.role != "Super Admin":
            active_subs = [s for s in active_subs if s.tenant_id == current_user.tenant_id or (not s.tenant_id)]

        is_already_shortlisted = existing_sub is not None and existing_sub.status in ("Shortlisted", "Accepted", "Under Review")

        if not is_already_shortlisted and len(active_subs) >= limit:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum candidate shortlist limit of {limit} reached for this requisition. You cannot shortlist more candidates."
            )
        
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

        # Seamlessly sync/upsert candidate submission into MongoDB
        try:
            from modules.shared.db import db
            mongo_doc = {
                "id": sub_id,
                "submission_id": sub_id,
                "requisition_id": requisition_id,
                "candidate_name": candidate_name,
                "candidate_email": candidate_email or "",
                "vendor_name": vendor_name or current_user.tenant_name or "bridgeon",
                "filename": filename or "",
                "fingerprint": "",
                "match_score": match_score or 0,
                "recommendation": recommendation or "Recommended",
                "status": "Shortlisted",
                "summary": summary or "",
                "tenant_id": current_user.tenant_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            db["candidate_submissions"].update_one(
                {"id": sub_id},
                {"$set": mongo_doc},
                upsert=True
            )
        except Exception as mongo_err:
            print(f"Failed to sync shortlisted candidate to MongoDB: {mongo_err}")

        notify_candidate_shortlisted(
            requisition_id=requisition_id,
            candidate_name=candidate_name,
            vendor_name=vendor_name or current_user.tenant_name or "Vendor A",
            match_score=match_score,
        )
        return {
            "status": "success",
            "message": f"Candidate {candidate_name} shortlisted and saved to candidate_submissions",
            "submission_id": sub_id
        }
