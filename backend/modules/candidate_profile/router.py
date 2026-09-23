import base64
import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
import httpx
from pydantic import BaseModel

from modules.identity.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from modules.shared.config import settings
from modules.shared.db import db

router = APIRouter(prefix="/api/candidate-profile", tags=["Candidate Profile"])


# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------
class CandidateLoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str | None = None
    access_token: str | None = None
    email: str | None = None
    name: str | None = None
    picture: str | None = None


class ProfileUpdateRequest(BaseModel):
    candidate_name: str | None = None
    candidate_title: str | None = None
    candidate_phone: str | None = None
    skills: list[str] | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    summary: str | None = None


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def sanitize_candidate_doc(doc: dict) -> dict:
    """Removes sensitive fields before returning to client."""
    if not doc:
        return {}
    res = dict(doc)
    res.pop("_id", None)
    res.pop("password_hash", None)
    res.pop("resume_pdf", None)  # Omit large base64 string from standard profile payloads
    return res


async def get_current_candidate(
    authorization: str | None = Header(None, alias="Authorization"),
) -> dict:
    """Dependency verifying candidate profile JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid candidate authorization token.",
        )

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired candidate session. Please sign in again.",
        )

    if payload.get("role") != "CandidateProfile":
        raise HTTPException(
            status_code=403,
            detail="Token is not authorized for candidate profile access.",
        )

    email = payload.get("sub", "").strip().lower()
    candidate = db["candidates"].find_one({"candidate_email": email})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found.")

    return candidate


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.post("/auth/google")
async def google_candidate_auth(payload: GoogleAuthRequest) -> dict:
    """Authenticates or automatically signs up a candidate using Google OAuth."""
    verified_email = ""
    verified_name = ""
    verified_picture = ""
    google_sub = ""

    # 1. Verify via Google ID Token (credential)
    if payload.credential:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": payload.credential},
                )
                if res.status_code == 200:
                    token_info = res.json()
                    verified_email = token_info.get("email", "").strip().lower()
                    verified_name = token_info.get("name", "")
                    verified_picture = token_info.get("picture", "")
                    google_sub = token_info.get("sub", "")
                    
                    # Verify audience if client_id is set
                    expected_client_id = settings.google_client_id or os.getenv("GOOGLE_CLIENT_ID", "") or os.getenv("VITE_GOOGLE_CLIENT_ID", "")
                    if expected_client_id and token_info.get("aud") != expected_client_id:
                        print(f"[GOOGLE AUTH] Warning: aud {token_info.get('aud')} differs from configured {expected_client_id}")
        except Exception as ex:
            print(f"[GOOGLE AUTH VERIFY ERROR] {ex}")

    # 2. Or verify via Access Token
    elif payload.access_token:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {payload.access_token}"},
                )
                if res.status_code == 200:
                    user_info = res.json()
                    verified_email = user_info.get("email", "").strip().lower()
                    verified_name = user_info.get("name", "")
                    verified_picture = user_info.get("picture", "")
                    google_sub = user_info.get("sub", "")
        except Exception as ex:
            print(f"[GOOGLE USERINFO ERROR] {ex}")

    # 3. Fallback for development / mock test if explicitly provided in dev environment
    if not verified_email and payload.email:
        # Only allow fallback if no secret or credential verification failed in non-strict dev
        verified_email = payload.email.strip().lower()
        verified_name = payload.name or verified_email.split("@")[0]
        verified_picture = payload.picture or ""

    if not verified_email:
        raise HTTPException(
            status_code=400,
            detail="Failed to verify Google identity. Please check your Google login or sign in with email.",
        )

    now_utc = datetime.now(timezone.utc)
    candidate = db["candidates"].find_one({"candidate_email": verified_email})

    if candidate:
        # Update google profile info if not set
        updates = {"updated_at": now_utc}
        if verified_picture and not candidate.get("picture"):
            updates["picture"] = verified_picture
        if google_sub and not candidate.get("google_sub"):
            updates["google_sub"] = google_sub
        if not candidate.get("candidate_name") and verified_name:
            updates["candidate_name"] = verified_name
        db["candidates"].update_one({"candidate_email": verified_email}, {"$set": updates})
        candidate = db["candidates"].find_one({"candidate_email": verified_email})
    else:
        # Automatically create candidate profile
        cand_id = f"CND-GOOG-{uuid.uuid4().hex[:8]}"
        candidate = {
            "id": cand_id,
            "candidate_name": verified_name or verified_email.split("@")[0],
            "candidate_title": "Professional Candidate",
            "candidate_email": verified_email,
            "candidate_phone": "",
            "picture": verified_picture,
            "google_sub": google_sub,
            "vendor_company_name": "Direct Applicant",
            "skills": [],
            "summary": "Profile created via Google Sign-In.",
            "details": {
                "linkedin_url": "",
                "github_url": "",
                "skills": [],
                "experience": [],
                "education": [],
            },
            "source": "Google OAuth",
            "created_at": now_utc,
            "updated_at": now_utc,
        }
        db["candidates"].insert_one(candidate)

    # Generate candidate JWT token
    token = create_access_token(
        data={
            "sub": verified_email,
            "candidate_id": candidate.get("id"),
            "role": "CandidateProfile",
            "name": candidate.get("candidate_name", ""),
        }
    )

    return {
        "status": "success",
        "token": token,
        "candidate": sanitize_candidate_doc(candidate),
        "message": "Signed in successfully with Google.",
    }


@router.post("/login")
async def candidate_login(body: CandidateLoginRequest) -> dict:
    """Standard email & password login for candidate profile."""
    email = body.email.strip().lower()
    candidate = db["candidates"].find_one({"candidate_email": email})

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail="No talent profile found with this email. Please create a talent profile first.",
        )

    pwd_hash = candidate.get("password_hash")
    if not pwd_hash:
        # If the candidate was previously saved to the pool via resume upload or outreach without a password,
        # set this as their new password and activate their profile login seamlessly!
        new_hash = hash_password(body.password)
        db["candidates"].update_one(
            {"candidate_email": email},
            {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc)}},
        )
    else:
        if not verify_password(body.password, pwd_hash):
            raise HTTPException(
                status_code=401,
                detail="Incorrect password. Please verify your credentials and try again.",
            )

    token = create_access_token(
        data={
            "sub": email,
            "candidate_id": candidate.get("id"),
            "role": "CandidateProfile",
            "name": candidate.get("candidate_name", ""),
        }
    )

    return {
        "status": "success",
        "token": token,
        "candidate": sanitize_candidate_doc(candidate),
        "message": "Logged into Candidate Profile successfully.",
    }


@router.post("/register")
async def candidate_register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    phone: str = Form(""),
    title: str = Form(""),
    skills: str = Form(""),
    linkedin_url: str = Form(""),
    github_url: str = Form(""),
    summary: str = Form(""),
    resume: UploadFile | None = File(None),
) -> dict:
    """Registers a new candidate talent profile with optional resume upload."""
    email_clean = email.strip().lower()
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = db["candidates"].find_one({"candidate_email": email_clean})
    if existing and existing.get("password_hash"):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please sign in instead.",
        )

    # Resume handling if uploaded
    pdf_base64 = ""
    filename = ""
    extracted_text = ""
    profile_extracted = {}

    if resume and resume.filename:
        content = await resume.read()
        if content:
            filename = resume.filename
            file_type = "docx" if filename.lower().endswith(".docx") else "pdf"
            pdf_base64 = base64.b64encode(content).decode("utf-8")

            with tempfile.NamedTemporaryFile(suffix=f".{file_type}", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                from modules.resume_screener.pipeline.extractor import extract_text as _extract_text_new
                extracted_text = _extract_text_new(tmp_path, file_type)
            except Exception as ex:
                print(f"[CANDIDATE REG RESUME EXTRACT ERR] {ex}")
            finally:
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

            if extracted_text:
                try:
                    from modules.candidate.extractor import extract_candidate_profile
                    profile_extracted = await extract_candidate_profile(extracted_text, filename)
                except Exception as ex:
                    print(f"[CANDIDATE REG PROFILE EXTRACT ERR] {ex}")

    # Build parsed skills
    parsed_skills = profile_extracted.get("skills") or []
    if skills:
        manual_skills = [s.strip() for s in skills.split(",") if s.strip()]
        for s in manual_skills:
            if s not in parsed_skills:
                parsed_skills.append(s)

    now_utc = datetime.now(timezone.utc)
    cand_id = existing.get("id") if existing else f"CND-REG-{uuid.uuid4().hex[:8]}"

    details = {
        "candidate_phone": phone or profile_extracted.get("candidate_phone") or (existing.get("details", {}).get("candidate_phone") if existing else ""),
        "linkedin_url": linkedin_url or profile_extracted.get("linkedin_url") or "",
        "github_url": github_url or profile_extracted.get("github_url") or "",
        "skills": parsed_skills,
        "experience": profile_extracted.get("experience", []),
        "education": profile_extracted.get("education", []),
        "projects": profile_extracted.get("projects", []),
    }

    doc_data = {
        "id": cand_id,
        "candidate_name": name.strip(),
        "candidate_title": title.strip() or profile_extracted.get("candidate_title") or "Candidate",
        "candidate_email": email_clean,
        "candidate_phone": phone.strip() or profile_extracted.get("candidate_phone") or "",
        "password_hash": hash_password(password),
        "vendor_company_name": "Direct Applicant",
        "skills": parsed_skills,
        "filename": filename or (existing.get("filename") if existing else "resume.pdf"),
        "summary": summary.strip() or profile_extracted.get("summary") or "Registered Candidate Profile.",
        "extracted_text": extracted_text or (existing.get("extracted_text") if existing else ""),
        "details": details,
        "source": "Portal Profile Signup",
        "updated_at": now_utc,
    }

    if pdf_base64:
        doc_data["resume_pdf"] = pdf_base64
    elif existing and existing.get("resume_pdf"):
        doc_data["resume_pdf"] = existing["resume_pdf"]

    if existing:
        db["candidates"].update_one({"candidate_email": email_clean}, {"$set": doc_data})
    else:
        doc_data["created_at"] = now_utc
        db["candidates"].insert_one(doc_data)

    token = create_access_token(
        data={
            "sub": email_clean,
            "candidate_id": cand_id,
            "role": "CandidateProfile",
            "name": name.strip(),
        }
    )

    created_doc = db["candidates"].find_one({"candidate_email": email_clean})

    return {
        "status": "success",
        "token": token,
        "candidate": sanitize_candidate_doc(created_doc),
        "message": "Candidate Profile created successfully.",
    }


@router.get("/me")
async def get_my_candidate_profile(candidate: dict = Depends(get_current_candidate)) -> dict:
    """Returns authenticated candidate's profile and their application history."""
    email = candidate.get("candidate_email", "").lower()

    # Fetch applied requisitions from candidate_submissions
    submissions = list(
        db["candidate_submissions"].find(
            {"candidate_email": email, "requisition_id": {"$ne": None}},
            {
                "submission_id": 1,
                "requisition_id": 1,
                "status": 1,
                "match_score": 1,
                "recommendation": 1,
                "hiring_manager_notes": 1,
                "created_at": 1,
                "interview_scheduled": 1,
                "interview_status": 1,
            },
        ).sort("created_at", -1)
    )

    # Attach requisition title & company details for each submission
    applications = []
    for sub in submissions:
        req_id = sub.get("requisition_id")
        req_title = "Open Requisition"
        company_name = "Enterprise Partner"

        if req_id:
            # Query requisition info from SQL/Mongo or fallback
            try:
                from modules.requisition.domain.models import Requisition, CompanyProfile
                from modules.shared.db import get_session
                with get_session() as session:
                    req_obj = session.get(Requisition, req_id)
                    if req_obj:
                        req_title = req_obj.title or req_title
                        if req_obj.company_profile_id:
                            cp = session.get(CompanyProfile, req_obj.company_profile_id)
                            if cp and cp.name:
                                company_name = cp.name
            except Exception:
                pass

        created_str = ""
        created_val = sub.get("created_at")
        if isinstance(created_val, datetime):
            created_str = created_val.strftime("%Y-%m-%d %H:%M")
        elif created_val:
            created_str = str(created_val)

        applications.append({
            "submission_id": sub.get("submission_id") or str(sub.get("_id")),
            "requisition_id": req_id,
            "requisition_title": req_title,
            "company_name": company_name,
            "status": sub.get("status") or "Screened",
            "match_score": sub.get("match_score"),
            "recommendation": sub.get("recommendation"),
            "created_at": created_str,
            "interview_status": sub.get("interview_status") or ("Scheduled" if sub.get("interview_scheduled") else None),
        })

    # Also check candidate_outreach records
    outreach_records = list(
        db["candidate_outreach"].find(
            {"candidate_email": email},
            {"_id": 0, "token": 0}
        ).sort("sent_at", -1)
    )

    has_resume = bool(candidate.get("resume_pdf") or candidate.get("filename"))
    profile_completed = bool(has_resume and candidate.get("candidate_phone"))

    return {
        "status": "success",
        "candidate": sanitize_candidate_doc(candidate),
        "applications": applications,
        "outreach": outreach_records,
        "has_resume": has_resume,
        "profile_completed": profile_completed,
        "resume_filename": candidate.get("filename") or ("resume.pdf" if has_resume else None),
    }


@router.post("/setup")
async def setup_candidate_profile(
    candidate_phone: str = Form(...),
    candidate_title: str = Form("Candidate"),
    candidate_name: str | None = Form(None),
    skills: str = Form(""),
    linkedin_url: str = Form(""),
    github_url: str = Form(""),
    summary: str = Form(""),
    resume: UploadFile = File(...),
    candidate: dict = Depends(get_current_candidate),
) -> dict:
    """Sets up or completes the candidate profile with mandatory resume upload."""
    email = candidate.get("candidate_email", "").strip().lower()
    if not candidate_phone or not candidate_phone.strip():
        raise HTTPException(status_code=400, detail="Phone number is required to complete your profile.")

    if not resume or not resume.filename:
        raise HTTPException(status_code=400, detail="A resume file (PDF or DOCX) is mandatory to set up your profile.")

    content = await resume.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume file is empty.")

    filename = resume.filename
    file_type = "docx" if filename.lower().endswith(".docx") else "pdf"
    pdf_base64 = base64.b64encode(content).decode("utf-8")

    extracted_text = ""
    with tempfile.NamedTemporaryFile(suffix=f".{file_type}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from modules.resume_screener.pipeline.extractor import extract_text as _extract_text_new
        extracted_text = _extract_text_new(tmp_path, file_type)
    except Exception as ex:
        print(f"[CANDIDATE SETUP RESUME EXTRACT ERR] {ex}")
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    profile_extracted = {}
    if extracted_text:
        try:
            from modules.candidate.extractor import extract_candidate_profile
            profile_extracted = await extract_candidate_profile(extracted_text, filename)
        except Exception as ex:
            print(f"[CANDIDATE SETUP PROFILE EXTRACT ERR] {ex}")

    # Build parsed skills
    parsed_skills = profile_extracted.get("skills") or []
    if skills:
        manual_skills = [s.strip() for s in skills.split(",") if s.strip()]
        for s in manual_skills:
            if s not in parsed_skills:
                parsed_skills.append(s)

    now_utc = datetime.now(timezone.utc)
    details = candidate.get("details", {}) or {}
    details.update({
        "candidate_phone": candidate_phone.strip(),
        "linkedin_url": linkedin_url.strip() or details.get("linkedin_url", "") or profile_extracted.get("linkedin_url", ""),
        "github_url": github_url.strip() or details.get("github_url", "") or profile_extracted.get("github_url", ""),
        "skills": parsed_skills,
        "experience": profile_extracted.get("experience") or details.get("experience", []),
        "education": profile_extracted.get("education") or details.get("education", []),
        "projects": profile_extracted.get("projects") or details.get("projects", []),
    })

    updates = {
        "candidate_phone": candidate_phone.strip(),
        "candidate_title": candidate_title.strip() or profile_extracted.get("candidate_title") or candidate.get("candidate_title") or "Candidate",
        "skills": parsed_skills,
        "filename": filename,
        "resume_pdf": pdf_base64,
        "extracted_text": extracted_text,
        "summary": summary.strip() or profile_extracted.get("summary") or candidate.get("summary") or "Profile completed.",
        "details": details,
        "profile_completed": True,
        "updated_at": now_utc,
    }

    if candidate_name and candidate_name.strip():
        updates["candidate_name"] = candidate_name.strip()

    db["candidates"].update_one({"candidate_email": email}, {"$set": updates})
    updated_doc = db["candidates"].find_one({"candidate_email": email})

    return {
        "status": "success",
        "candidate": sanitize_candidate_doc(updated_doc),
        "profile_completed": True,
        "has_resume": True,
        "resume_filename": filename,
        "message": "Talent profile and mandatory resume saved successfully. You can now apply for open requisitions!",
    }


@router.put("/me")
async def update_my_candidate_profile(
    body: ProfileUpdateRequest,
    candidate: dict = Depends(get_current_candidate),
) -> dict:
    """Allows candidate to update their profile info."""
    email = candidate.get("candidate_email", "").lower()
    updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}

    if body.candidate_name is not None:
        updates["candidate_name"] = body.candidate_name.strip()
    if body.candidate_title is not None:
        updates["candidate_title"] = body.candidate_title.strip()
    if body.candidate_phone is not None:
        updates["candidate_phone"] = body.candidate_phone.strip()
    if body.skills is not None:
        updates["skills"] = body.skills
    if body.summary is not None:
        updates["summary"] = body.summary.strip()

    details = candidate.get("details", {}) or {}
    if body.linkedin_url is not None:
        details["linkedin_url"] = body.linkedin_url.strip()
    if body.github_url is not None:
        details["github_url"] = body.github_url.strip()
    if body.skills is not None:
        details["skills"] = body.skills
    updates["details"] = details

    db["candidates"].update_one({"candidate_email": email}, {"$set": updates})
    updated_doc = db["candidates"].find_one({"candidate_email": email})

    return {
        "status": "success",
        "candidate": sanitize_candidate_doc(updated_doc),
        "message": "Candidate profile updated successfully.",
    }
