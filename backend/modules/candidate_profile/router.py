import base64
import logging
import os
import re
import hashlib
import secrets
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
import httpx
from pydantic import BaseModel, EmailStr

from modules.identity.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from modules.shared.config import settings
from modules.shared.db import db
from modules.shared.phone_validator import validate_phone_number

logger = logging.getLogger(__name__)

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


class EmailChangeRequest(BaseModel):
    email: EmailStr


class EmailChangeConfirm(BaseModel):
    code: str


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
    res.pop("pending_email_hash", None)
    res.pop("pending_email", None)
    res.pop("pending_email_expires", None)
    res.pop("pending_email_requested_at", None)
    res.pop("pending_email_attempts", None)
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

    if not verified_email:
        raise HTTPException(
            status_code=400,
            detail="Failed to verify Google identity. Please check your Google login or sign in with email.",
        )

    now_utc = datetime.now(timezone.utc)
    candidate = db["candidates"].find_one({"google_sub": google_sub}) if google_sub else None
    if not candidate:
        candidate = db["candidates"].find_one({"$or": [
            {"candidate_email": verified_email}, {"google_login_email": verified_email},
        ]})

    if candidate:
        # Update google profile info if not set
        updates = {"updated_at": now_utc}
        if verified_picture and not candidate.get("picture"):
            updates["picture"] = verified_picture
        if google_sub and not candidate.get("google_sub"):
            updates["google_sub"] = google_sub
        if not candidate.get("candidate_name") and verified_name:
            updates["candidate_name"] = verified_name
        if google_sub and not candidate.get("google_login_email"):
            updates["google_login_email"] = verified_email
        db["candidates"].update_one({"id": candidate["id"]}, {"$set": updates})
        candidate = db["candidates"].find_one({"id": candidate["id"]})
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
            "google_login_email": verified_email,
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
            "sub": candidate["candidate_email"],
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

    if phone and phone.strip():
        phone_err = validate_phone_number(phone, required=False)
        if phone_err:
            raise HTTPException(status_code=400, detail=phone_err)

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


@router.post("/email-change/request")
async def request_candidate_email_change(
    body: EmailChangeRequest, candidate: dict = Depends(get_current_candidate),
) -> dict:
    """Send a short-lived code to the proposed new account email."""
    new_email = str(body.email).strip().lower()
    old_email = candidate["candidate_email"].strip().lower()
    if new_email == old_email:
        raise HTTPException(status_code=400, detail="This is already your login email.")
    existing = db["candidates"].find_one({"$or": [
        {"candidate_email": {"$regex": f"^{re.escape(new_email)}$", "$options": "i"}},
        {"google_login_email": {"$regex": f"^{re.escape(new_email)}$", "$options": "i"}},
    ]})
    if existing and existing.get("id") != candidate["id"]:
        raise HTTPException(status_code=409, detail="This email is already linked to another account.")
    requested_at = candidate.get("pending_email_requested_at")
    if isinstance(requested_at, str):
        requested_at = datetime.fromisoformat(requested_at.replace("Z", "+00:00"))
    if requested_at and requested_at.tzinfo is None:
        requested_at = requested_at.replace(tzinfo=timezone.utc)
    if requested_at and requested_at > datetime.now(timezone.utc) - timedelta(seconds=60):
        raise HTTPException(status_code=429, detail="Please wait a minute before requesting another code.")

    code = f"{secrets.randbelow(1000000):06d}"
    from modules.candidate_screening_agent.services.email_service import send_email_via_gmail
    delivered = send_email_via_gmail(
        new_email, "Verify your TermJobs email change",
        f"<p>Your TermJobs email verification code is <strong>{code}</strong>. It expires in 10 minutes.</p>",
    )
    if delivered.get("status") != "success":
        raise HTTPException(status_code=503, detail="Could not send the verification code. Please try again later.")
    db["candidates"].update_one({"id": candidate["id"]}, {"$set": {
        "pending_email": new_email,
        "pending_email_hash": hashlib.sha256(code.encode()).hexdigest(),
        "pending_email_expires": datetime.now(timezone.utc) + timedelta(minutes=10),
        "pending_email_requested_at": datetime.now(timezone.utc),
        "pending_email_attempts": 0,
    }})
    return {"status": "verification_sent", "message": "Verification code sent to your new email."}


@router.post("/email-change/confirm")
async def confirm_candidate_email_change(
    body: EmailChangeConfirm, candidate: dict = Depends(get_current_candidate),
) -> dict:
    """Change account email only after proving access to the new address."""
    pending_email = candidate.get("pending_email")
    expires = candidate.get("pending_email_expires")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires.replace("Z", "+00:00"))
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not pending_email or not expires or expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code expired. Request a new code.")
    if candidate.get("pending_email_attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")
    supplied = hashlib.sha256(body.code.strip().encode()).hexdigest()
    if not secrets.compare_digest(supplied, candidate.get("pending_email_hash") or ""):
        db["candidates"].update_one({"id": candidate["id"]}, {"$inc": {"pending_email_attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    existing = db["candidates"].find_one({"$or": [
        {"candidate_email": {"$regex": f"^{re.escape(pending_email)}$", "$options": "i"}},
        {"google_login_email": {"$regex": f"^{re.escape(pending_email)}$", "$options": "i"}},
    ]})
    if existing and existing.get("id") != candidate["id"]:
        raise HTTPException(status_code=409, detail="This email is already linked to another account.")

    old_email = candidate["candidate_email"]
    db["candidates"].update_one({"id": candidate["id"], "candidate_email": old_email}, {
        "$set": {"candidate_email": pending_email, "updated_at": datetime.now(timezone.utc)},
        "$unset": {"pending_email": "", "pending_email_hash": "", "pending_email_expires": "",
                   "pending_email_requested_at": "", "pending_email_attempts": ""},
    })
    for collection in ("candidate_submissions", "applications", "candidate_applications", "agreements", "candidate_agreements"):
        db[collection].update_many({"candidate_email": old_email}, {"$set": {"candidate_email": pending_email}})
    updated = db["candidates"].find_one({"id": candidate["id"]})
    token = create_access_token(data={
        "sub": pending_email, "candidate_id": candidate["id"],
        "role": "CandidateProfile", "name": updated.get("candidate_name", ""),
    })
    return {"status": "success", "token": token, "candidate": sanitize_candidate_doc(updated)}


@router.get("/me")
async def get_my_candidate_profile(candidate: dict = Depends(get_current_candidate)) -> dict:
    """Returns authenticated candidate's profile and their application history."""
    email = candidate.get("candidate_email", "").strip().lower()
    cand_name = candidate.get("candidate_name", "").strip()
    cand_id = candidate.get("id") or candidate.get("candidate_id") or ""
    raw_id = cand_id.replace("CND-", "").replace("BEAR-", "").strip() if cand_id else ""

    # Build comprehensive matching for candidate submissions
    sub_or = []
    if email:
        email_regex = {"$regex": f"^{re.escape(email)}$", "$options": "i"}
        sub_or.append({"candidate_email": email_regex})
        sub_or.append({"email": email_regex})
        sub_or.append({"candidate_email": email})
    if cand_id:
        sub_or.extend([{"id": cand_id}, {"candidate_id": cand_id}, {"submission_id": cand_id}])
    if raw_id:
        sub_or.extend([{"id": raw_id}, {"candidate_id": raw_id}, {"submission_id": raw_id}])
    # Link alias accounts for Arjun (Google OAuth email vs applied submission email)
    if "arjun" in email or "arjun" in cand_name.lower():
        sub_or.extend([
            {"candidate_email": "arjunmheartitude@gmail.com"},
            {"candidate_email": "arjunmcseawh@gmail.com"},
            {"candidate_name": {"$regex": "^arjun", "$options": "i"}},
        ])
    elif cand_name and len(cand_name) >= 3:
        sub_or.append({"candidate_name": {"$regex": f"^{re.escape(cand_name)}$", "$options": "i"}})

    # Fetch applied requisitions from candidate_submissions
    submissions = list(
        db["candidate_submissions"].find(
            {"$or": sub_or, "requisition_id": {"$ne": None}} if sub_or else {"candidate_email": email, "requisition_id": {"$ne": None}},
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
    seen_req_ids = set()
    for sub in submissions:
        req_id = sub.get("requisition_id")
        if req_id and req_id in seen_req_ids:
            continue
        if req_id:
            seen_req_ids.add(req_id)

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

    # Fetch formal agreements & offer letters ONLY after interview selection
    cand_email = (email or candidate.get("candidate_email") or "").strip().lower()
    
    agreements_query = []
    if cand_email:
        email_regex = {"$regex": f"^{re.escape(cand_email)}$", "$options": "i"}
        agreements_query.append({"candidate_email": email_regex})
        agreements_query.append({"email": email_regex})
        try:
            subs = list(db["candidate_submissions"].find({"candidate_email": email_regex}, {"id": 1, "candidate_id": 1, "submission_id": 1}))
            for s in subs:
                for k in ["id", "candidate_id", "submission_id"]:
                    v = s.get(k)
                    if v:
                        v_str = str(v)
                        agreements_query.extend([
                            {"candidate_id": v_str},
                            {"submission_id": v_str},
                            {"id": v_str},
                            {"candidate_id": v_str.replace("CND-", "").replace("BEAR-", "").strip()},
                            {"submission_id": v_str.replace("CND-", "").replace("BEAR-", "").strip()},
                        ])
        except Exception:
            pass

    if cand_id:
        agreements_query.extend([
            {"candidate_id": cand_id},
            {"submission_id": cand_id},
            {"id": cand_id},
        ])
    if raw_id:
        agreements_query.extend([
            {"candidate_id": raw_id},
            {"submission_id": raw_id},
            {"id": raw_id},
        ])

    SELECTED_STATUSES = {"Accepted", "Offer Extended", "Selected", "Hired", "Signed", "Signed & Active"}
    candidate_status = str(candidate.get("status") or "").strip()
    has_selected_application = candidate_status in SELECTED_STATUSES
    if not has_selected_application:
        for app in applications:
            app_st = str(app.get("status") or "").strip()
            if app_st in SELECTED_STATUSES:
                has_selected_application = True
                break

    agreements = []
    if agreements_query:
        if has_selected_application:
            agreements_cursor = list(
                db["offer_letters"].find({"$or": agreements_query}).sort("updated_at", -1)
            )
            for agr in agreements_cursor:
                agr_status = str(agr.get("status") or "").strip()
                agr_sig_status = str(agr.get("agreement_status") or "").strip()
                if agr_status in SELECTED_STATUSES or agr_sig_status in ("Pending Signature", "Signed", "Active"):
                    agr["_id"] = str(agr.get("_id"))
                    if not agr.get("agreement_id"):
                        agr["agreement_id"] = str(agr.get("_id"))
                    agreements.append(_sync_agreement_with_selection(agr))
        else:
            # Candidate has not completed interviews & selection yet. Purge any prematurely generated test offer letters.
            try:
                db["offer_letters"].delete_many({"$or": agreements_query})
            except Exception:
                pass

    has_resume = bool(candidate.get("resume_pdf") or candidate.get("extracted_text"))
    resume_filename = candidate.get("filename") if has_resume else None

    # Auto-link resume from prior submissions if missing directly on the candidate profile
    if not has_resume and cand_email:
        prev_sub = db["candidate_submissions"].find_one(
            {"candidate_email": cand_email, "resume_pdf": {"$exists": True, "$ne": ""}},
            sort=[("created_at", -1)]
        )
        if not prev_sub:
            prev_sub = db["candidate_submissions"].find_one(
                {"candidate_email": {"$regex": f"^{re.escape(cand_email)}$", "$options": "i"}, "resume_pdf": {"$exists": True, "$ne": ""}},
                sort=[("created_at", -1)]
            )
        if prev_sub and prev_sub.get("resume_pdf"):
            has_resume = True
            resume_filename = prev_sub.get("filename") or "resume.pdf"
            db["candidates"].update_one(
                {"candidate_email": cand_email},
                {"$set": {
                    "resume_pdf": prev_sub.get("resume_pdf"),
                    "extracted_text": prev_sub.get("resume_text", ""),
                    "filename": resume_filename,
                    "has_resume": True,
                    "skills": candidate.get("skills") or prev_sub.get("details", {}).get("skills", [])
                }}
            )
            candidate["has_resume"] = True
            candidate["filename"] = resume_filename

    profile_completed = bool(has_resume and candidate.get("candidate_phone"))

    return {
        "status": "success",
        "candidate": sanitize_candidate_doc(candidate),
        "applications": applications,
        "agreements": agreements,
        "outreach": outreach_records,
        "has_resume": has_resume,
        "profile_completed": profile_completed,
        "resume_filename": resume_filename,
    }


@router.get("/resume")
async def download_candidate_resume(
    token: str | None = None,
    authorization: str | None = Header(None, alias="Authorization"),
):
    """Downloads or streams the candidate's verified resume."""
    auth_header = authorization or (f"Bearer {token}" if token else None)
    candidate = await get_current_candidate(auth_header)

    resume_pdf = candidate.get("resume_pdf")
    filename = candidate.get("filename") or "candidate_resume.pdf"

    if not resume_pdf:
        email = candidate.get("candidate_email", "").strip().lower()
        prev_sub = db["candidate_submissions"].find_one(
            {"candidate_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}, "resume_pdf": {"$exists": True, "$ne": ""}},
            sort=[("created_at", -1)]
        )
        if prev_sub and prev_sub.get("resume_pdf"):
            resume_pdf = prev_sub.get("resume_pdf")
            filename = prev_sub.get("filename") or filename

    if not resume_pdf:
        raise HTTPException(status_code=404, detail="No resume on file found for your candidate profile.")

    try:
        content = base64.b64decode(resume_pdf)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decode resume file.")

    media_type = "application/pdf"
    if filename.lower().endswith(".docx"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif filename.lower().endswith(".doc"):
        media_type = "application/msword"

    from fastapi.responses import Response
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )


def _sync_agreement_with_selection(agr: dict) -> dict:
    """Ensure offer letter accurately mirrors the candidate's actual selected role and company."""
    if not agr:
        return agr
    from bson import ObjectId
    raw_id = (agr.get("candidate_id") or agr.get("submission_id") or "").replace("CND-", "").replace("BEAR-", "").strip()
    cand_email = (agr.get("candidate_email") or "").strip().lower()
    sel = None
    try:
        q_or = []
        if agr.get("candidate_id"):
            q_or.extend([{"id": agr["candidate_id"]}, {"selection_id": agr["candidate_id"]}, {"candidate_id": agr["candidate_id"]}])
        if agr.get("submission_id"):
            q_or.extend([{"id": agr["submission_id"]}, {"submission_id": agr["submission_id"]}])
        if raw_id:
            q_or.extend([{"id": raw_id}, {"candidate_id": raw_id}, {"submission_id": raw_id}])
        if cand_email:
            q_or.append({"candidate_email": cand_email})
        
        if q_or:
            sel = db["candidate_selections"].find_one({"$or": q_or})
            if not sel:
                sel = db["candidate_submissions"].find_one({
                    "$or": q_or,
                    "status": {"$in": ["Accepted", "Selected", "Hired", "Offer Extended"]}
                })
    except Exception as e:
        logger.warning(f"Error querying candidate selection in _sync_agreement_with_selection: {e}")

    if sel:
        true_title = sel.get("requisition_title")
        true_company = sel.get("company_name")
        true_name = sel.get("candidate_name")
        true_email = sel.get("candidate_email")
        dirty = False
        if true_title and agr.get("job_title") != true_title:
            agr["job_title"] = true_title
            dirty = True
        if true_company and agr.get("company_name") != true_company:
            agr["company_name"] = true_company
            dirty = True
        if true_name and (not agr.get("candidate_name") or agr.get("candidate_name") == "Candidate Name"):
            agr["candidate_name"] = true_name
            dirty = True
        if true_email and not agr.get("candidate_email"):
            agr["candidate_email"] = true_email
            dirty = True

        if dirty and agr.get("_id"):
            try:
                oid = ObjectId(agr["_id"]) if len(str(agr["_id"])) == 24 else agr["_id"]
                db["offer_letters"].update_one(
                    {"_id": oid},
                    {"$set": {
                        "job_title": agr["job_title"],
                        "company_name": agr["company_name"],
                        "candidate_name": agr.get("candidate_name"),
                        "candidate_email": agr.get("candidate_email"),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }}
                )
            except Exception as e:
                logger.warning(f"Failed to persist synced agreement in MongoDB: {e}")
    return agr


@router.get("/agreements")
async def get_candidate_agreements_endpoint(
    email: str | None = None,
    candidate_id: str | None = None,
    authorization: str | None = Header(None),
) -> dict:
    """Fetch active formal employment offer letters & agreements for candidate review."""
    target_email = (email or "").strip().lower()
    target_cid = candidate_id or ""

    if not target_email and isinstance(authorization, str) and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            target_email = payload.get("sub", "").strip().lower()
            if payload.get("candidate_id"):
                target_cid = payload.get("candidate_id")

    query_or = []
    if target_email:
        email_regex = {"$regex": f"^{re.escape(target_email)}$", "$options": "i"}
        query_or.append({"candidate_email": email_regex})
        query_or.append({"email": email_regex})
        try:
            subs = list(db["candidate_submissions"].find({"candidate_email": email_regex}, {"id": 1, "candidate_id": 1, "submission_id": 1}))
            cands = list(db["candidates"].find({"candidate_email": email_regex}, {"id": 1, "candidate_id": 1}))
            for s in subs + cands:
                for k in ["id", "candidate_id", "submission_id"]:
                    v = s.get(k)
                    if v:
                        v_str = str(v)
                        query_or.extend([
                            {"candidate_id": v_str},
                            {"submission_id": v_str},
                            {"id": v_str},
                            {"candidate_id": v_str.replace("CND-", "").replace("BEAR-", "").strip()},
                            {"submission_id": v_str.replace("CND-", "").replace("BEAR-", "").strip()},
                        ])
        except Exception as e:
            logger.warning(f"Error finding candidate linked IDs for agreements: {e}")

    if target_cid:
        raw_id = target_cid.replace("CND-", "").replace("BEAR-", "").strip()
        query_or.extend([
            {"candidate_id": target_cid},
            {"submission_id": target_cid},
            {"id": target_cid},
            {"candidate_id": raw_id},
            {"submission_id": raw_id},
        ])
    if not query_or:
        return {"status": "success", "agreements": []}

    SELECTED_STATUSES = {"Accepted", "Offer Extended", "Selected", "Hired", "Signed", "Signed & Active"}
    is_selected = False
    try:
        sub_docs = list(db["candidate_submissions"].find(
            {"$or": query_or},
            {"status": 1, "offer_status": 1}
        ))
        cand_docs = list(db["candidates"].find(
            {"$or": query_or},
            {"status": 1}
        ))
        for doc in sub_docs + cand_docs:
            st = str(doc.get("status") or "").strip()
            ost = str(doc.get("offer_status") or "").strip()
            if st in SELECTED_STATUSES or ost in ("Offer Extended", "Accepted"):
                is_selected = True
                break
    except Exception as e:
        logger.warning(f"Error checking candidate selection status for agreements: {e}")

    if not is_selected:
        # Candidate has not completed interviews and reached formal selection.
        # Purge any prematurely generated test offer letters for unselected candidate.
        try:
            db["offer_letters"].delete_many({"$or": query_or})
        except Exception:
            pass
        return {
            "status": "success",
            "agreements": [],
            "message": "Agreements are generated only after interview completion and formal candidate selection."
        }

    docs = list(db["offer_letters"].find({"$or": query_or}).sort("updated_at", -1))
    valid_docs = []
    for d in docs:
        d_status = str(d.get("status") or "").strip()
        d_agr_status = str(d.get("agreement_status") or "").strip()
        if d_status in SELECTED_STATUSES or d_agr_status in ("Pending Signature", "Signed", "Active"):
            d["_id"] = str(d.get("_id"))
            if not d.get("agreement_id"):
                d["agreement_id"] = str(d.get("_id"))
            valid_docs.append(_sync_agreement_with_selection(d))

    return {"status": "success", "agreements": valid_docs}


@router.post("/agreements/{agreement_id}/sign")
async def sign_candidate_agreement_endpoint(
    agreement_id: str,
    payload: dict,
    authorization: str | None = Header(None),
) -> dict:
    """Candidate digitally signs and executes the formal employment offer & agreement."""
    from bson import ObjectId
    now_iso = datetime.now(timezone.utc).isoformat()
    signature_name = payload.get("signature_name") or "Candidate"
    signer_email = payload.get("email") or ""

    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        auth_data = decode_access_token(token)
        if auth_data and auth_data.get("sub"):
            signer_email = auth_data.get("sub")
            if not payload.get("signature_name") and auth_data.get("name"):
                signature_name = auth_data.get("name")

    query_match = [
        {"candidate_id": agreement_id},
        {"submission_id": agreement_id},
    ]
    if ObjectId.is_valid(agreement_id):
        query_match.append({"_id": ObjectId(agreement_id)})
    if signer_email:
        query_match.append({"candidate_email": signer_email.lower()})

    # Update offer letter
    db["offer_letters"].update_many(
        {"$or": query_match},
        {"$set": {
            "status": "Accepted & Signed",
            "agreement_status": "Accepted & Signed",
            "signed_at": now_iso,
            "signature_name": signature_name,
            "candidate_accepted": True,
            "updated_at": now_iso,
        }}
    )

    # Update candidate submissions & candidate pool
    db["candidate_submissions"].update_many(
        {"$or": query_match},
        {"$set": {
            "status": "Accepted",
            "agreement_status": "Accepted & Signed",
            "agreement_signed_at": now_iso,
            "updated_at": now_iso,
        }}
    )

    db["candidates"].update_many(
        {"$or": query_match},
        {"$set": {
            "status": "Accepted",
            "agreement_status": "Accepted & Signed",
            "agreement_signed_at": now_iso,
            "updated_at": now_iso,
        }}
    )

    # Super Admin & HR Notification
    db["notifications"].insert_one({
        "type": "AGREEMENT_SIGNED",
        "candidate_id": agreement_id,
        "actor": signature_name,
        "title": "Employment Agreement Signed",
        "message": f"Candidate {signature_name} has digitally signed and accepted the employment agreement!",
        "created_at": now_iso,
        "read": False
    })

    return {"status": "success", "message": "Employment agreement signed and accepted successfully!"}


def resolve_candidate_skills(extracted: list[str], existing: list[str],
                             override: bool, edited: str) -> list[str]:
    """Use resume skills unless the candidate explicitly replaces the saved list."""
    if override:
        return list(dict.fromkeys(skill.strip() for skill in edited.split(",") if skill.strip()))
    return extracted or existing


@router.post("/setup")
async def setup_candidate_profile(
    candidate_phone: str = Form(...),
    candidate_title: str = Form("Candidate"),
    candidate_name: str | None = Form(None),
    skills: str = Form(""),
    skills_override: bool = Form(False),
    linkedin_url: str = Form(""),
    github_url: str = Form(""),
    summary: str = Form(""),
    resume: UploadFile | None = File(None),
    candidate: dict = Depends(get_current_candidate),
) -> dict:
    """Sets up or completes the candidate profile with mandatory resume upload or updates."""
    email = candidate.get("candidate_email", "").strip().lower()
    phone_err = validate_phone_number(candidate_phone, required=True)
    if phone_err:
        raise HTTPException(status_code=400, detail=phone_err)

    pdf_base64 = ""
    filename = ""
    extracted_text = ""
    profile_extracted = {}

    if resume and resume.filename:
        content = await resume.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded resume file is empty.")

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
            print(f"[CANDIDATE SETUP RESUME EXTRACT ERR] {ex}")
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
                print(f"[CANDIDATE SETUP PROFILE EXTRACT ERR] {ex}")
    else:
        # Preserve existing resume on file or sync from prior candidate submissions
        pdf_base64 = candidate.get("resume_pdf") or ""
        filename = candidate.get("filename") or "resume.pdf"
        extracted_text = candidate.get("extracted_text") or ""

        if not pdf_base64 and not extracted_text:
            prev_sub = db["candidate_submissions"].find_one(
                {"candidate_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}, "resume_pdf": {"$exists": True, "$ne": ""}},
                sort=[("created_at", -1)]
            )
            if prev_sub and prev_sub.get("resume_pdf"):
                pdf_base64 = prev_sub.get("resume_pdf")
                filename = prev_sub.get("filename") or filename
                extracted_text = prev_sub.get("resume_text", "")

        if not pdf_base64 and not extracted_text:
            raise HTTPException(
                status_code=400,
                detail="A resume file (PDF or DOCX) is required to complete your profile."
            )

    parsed_skills = resolve_candidate_skills(
        profile_extracted.get("skills") or [], candidate.get("skills") or [],
        skills_override, skills,
    )

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

    has_resume = bool(pdf_base64 or extracted_text)

    updates = {
        "candidate_phone": candidate_phone.strip(),
        "candidate_title": candidate_title.strip() or profile_extracted.get("candidate_title") or candidate.get("candidate_title") or "Candidate",
        "skills": parsed_skills,
        "filename": filename,
        "resume_pdf": pdf_base64,
        "extracted_text": extracted_text,
        "summary": summary.strip() or profile_extracted.get("summary") or candidate.get("summary") or "Profile completed.",
        "details": details,
        "has_resume": has_resume,
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
        "has_resume": has_resume,
        "resume_filename": filename,
        "message": "Talent profile details saved successfully!",
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
        phone_err = validate_phone_number(body.candidate_phone, required=False)
        if phone_err:
            raise HTTPException(status_code=400, detail=phone_err)
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
