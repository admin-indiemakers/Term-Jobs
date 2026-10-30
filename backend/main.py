# Reload trigger: Interview candidate booked-slots route updated
"""FastAPI app exposing the requisition module for end-to-end testing.

Run:
    uv run uvicorn main:app --reload --port 8000

Configuration via environment (see .env.example):
    MONGODB_URL  - MongoDB Atlas connection string (default localhost:27017).
    LLM_PROVIDER - "groq" (default, cloud LLM) or "mock" (offline tests).

Quick test (company -> requisition -> approve -> publish):
    curl -X POST localhost:8000/company-profiles -H 'content-type: application/json' \
         -d '{"name":"Acme","location":"Bangalore","tech_stack":["Python","Django","Postgres"]}'
    # then POST /requisitions with the returned profile id
"""


import json
import os
import sys
import uuid
import base64
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
import logging

logger = logging.getLogger(__name__)

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, Form, Query, Request, BackgroundTasks
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse

from pydantic import BaseModel, Field, field_validator

from modules.candidate.router import router as candidate_router
from modules.identity.domain.models import User, VendorEngagement, Tenant
from modules.identity.router import get_current_user

from modules.calendar.router import router as calendar_router
from modules.identity.router import router as identity_router
from modules.notifications.router import router as notifications_router
from modules.notifications.services.notification_service import notify_requisition_published
from modules.requisition.domain import models, schemas
from modules.requisition.domain.deadline import validate_submission_deadline, validate_start_date, submission_deadline_passed
from modules.requisition.services.deadline_policy import enforce_approval_deadline, DeadlineExpired
from modules.requisition.domain.state import StateMachine
from modules.shared.db import get_session, init_db, _utcnow
from modules.shared.cache import cache as _cache
from modules.resume_screener.router import router as resume_screener_router
from modules.interview.router import router as interview_router
from modules.onboarding.router import router as onboarding_router
from modules.candidate_portal.router import router as candidate_portal_router
from modules.workforce.router import router as workforce_router
from modules.workorder.router import router as workorder_router
from modules.superadmin_agent.router import router as superadmin_agent_router
from modules.company_admin_agent.router import router as company_admin_agent_router
from modules.hiring_manager_agent.router import router as hiring_manager_agent_router
from modules.billing.router import router as vendor_billing_router
from modules.superadmin_agent.voice_router import router as voice_router
from modules.onboarding.offboarding_router import router as offboarding_router
from modules.candidate_profile.router import router as candidate_profile_router
from modules.hm_zoho_cliq import zoho_cliq_router
from modules.integrations import integrations_router
from modules.hm_telegram_bot import telegram_bot_router
from modules.hm_teams_bot import teams_bot_router
from modules.team_chat.router import router as team_chat_router
from modules.backup.router import router as backup_router


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern lifespan context manager for startup & shutdown tasks."""
    is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    worker_task = None

    if not is_serverless:
        try:
            from modules.candidate.telegram_service import start_telegram_polling
            start_telegram_polling()
            print("[APP STARTUP] Candidate Telegram Bot long-polling initialized successfully.")
        except Exception as exc:
            print(f"[APP STARTUP TELEGRAM ERROR] {exc}")

        try:
            from modules.hm_telegram_bot.bot import start_hm_bot_polling
            start_hm_bot_polling()
            print("[APP STARTUP] Hiring Manager Telegram Bot initialized successfully.")
        except Exception as exc:
            print(f"[APP STARTUP HM TELEGRAM ERROR] {exc}")

        # Launch background worker for periodic maintenance (auto-close expired & 48h shortlists)
        async def _background_worker():
            while True:
                try:
                    await asyncio.sleep(60)
                    from modules.interview.services.reminders import dispatch_due_interview_reminders
                    await asyncio.to_thread(dispatch_due_interview_reminders)
                    _auto_close_expired()
                    from modules.candidate.shortlist_service import auto_check_and_dispatch_48h_shortlists
                    auto_check_and_dispatch_48h_shortlists()
                except asyncio.CancelledError:
                    break
                except Exception:
                    pass
        worker_task = asyncio.create_task(_background_worker())

    yield

    # Shutdown
    if worker_task:
        worker_task.cancel()
    if not is_serverless:
        try:
            from modules.candidate.telegram_service import stop_telegram_polling
            stop_telegram_polling()
        except Exception:
            pass
        try:
            from modules.hm_telegram_bot.bot import stop_hm_bot_polling
            stop_hm_bot_polling()
        except Exception:
            pass


app = FastAPI(
    title="TermJobs Requisition API",
    description="Intake and structure job requisitions using AI agents.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(404)
async def custom_404_handler(request: Request, exc):
    detail = getattr(exc, 'detail', None)
    if detail and detail != 'Not Found':
        return JSONResponse(status_code=404, content={'detail': detail})
    return JSONResponse(status_code=404, content={'error': 'Route Not Found'})

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://termjobs.in",
        "https://www.termjobs.in",
        "https://termjobs.vercel.app",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$|^https://.*\.vercel\.app$|^https://(www\.)?termjobs\.in$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400,
)

@app.middleware("http")
async def vercel_routing_middleware(request: Request, call_next):
    target = request.query_params.get("__vercel_path")
    if target:
        if target.startswith("//"):
            target = "/" + target.lstrip("/")
        if "?" in target:
            target = target.split("?")[0]
        request.scope["path"] = target
        request.scope["root_path"] = ""

    origin = request.headers.get("origin")
    req_headers = request.headers.get("access-control-request-headers")
    default_headers = "Authorization, Content-Type, Accept, Origin, X-Requested-With, X-CSRF-Token, Cache-Control, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version"
    allowed_headers = req_headers if req_headers and req_headers.strip() and req_headers.strip() != "*" else default_headers

    print(f" [CORS LOG] {request.method} {request.url.path} | Origin: {origin} | AllowedHeaders: {allowed_headers}")

    # Dynamic DB routing: detect whether the incoming request is targeting QA/Dev or Main
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").lower()
    referer = (request.headers.get("referer") or "").lower()
    origin_header = (origin or "").lower()
    combined = f"{host} {referer} {origin_header}"

    qa_dev_keywords = (
        "-git-qa-", "-git-dev-", "git-qa", "git-dev",
        "term-jobs-git-qa", "term-jobs-git-dev",
        "term-jobs-qa", "term-jobs-dev",
        "termjobs-qa", "termjobs-dev",
        "-qa.", "-dev.",
    )
    if any(kw in combined for kw in qa_dev_keywords):
        target_cluster = "dev_qa"
    elif any(kw in combined for kw in ("termjobs.in", "term-jobs-git-main", "-git-main-")):
        target_cluster = "main"
    else:
        from modules.shared.config import is_dev_qa_environment
        target_cluster = "dev_qa" if is_dev_qa_environment() else "main"

    from modules.shared.config import current_cluster_var
    token = current_cluster_var.set(target_cluster)

    try:
        # Handle OPTIONS preflight explicitly to prevent Vercel / serverless CORS blocking
        if request.method == "OPTIONS":
            from fastapi.responses import Response
            res_origin = origin if origin else "*"
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": res_origin,
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": allowed_headers,
                    "Access-Control-Allow-Credentials": "true",
                },
            )

        response = await call_next(request)

        # Ensure CORS headers on all HTTP responses for any origin
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = allowed_headers

        return response
    finally:
        current_cluster_var.reset(token)

# --- Global Exception Handlers with CORS Preservation & Debug Logging ---
import traceback
from fastapi.responses import JSONResponse

def _get_cors_headers(request: Request) -> dict:
    headers = getattr(request, "headers", None)
    origin = headers.get("origin") if headers and hasattr(headers, "get") else None
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://termjobs.in",
        "https://www.termjobs.in",
        "https://termjobs.vercel.app",
    ]
    res_origin = origin if origin and (origin in allowed_origins or "localhost" in origin or "127.0.0.1" in origin or "vercel.app" in origin) else (origin or "*")
    cors_headers = {
        "Access-Control-Allow-Origin": res_origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, X-Requested-With, Cache-Control",
    }
    if res_origin != "*":
        cors_headers["Access-Control-Allow-Credentials"] = "true"
    return cors_headers


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    method = getattr(request, "method", "WEBSOCKET")
    url = getattr(request, "url", None)
    path = getattr(url, "path", "") if url else ""
    error_msg = f" [UNHANDLED BACKEND SERVER ERROR] {method} {path}: {exc}"
    print(error_msg, file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal Server Error: {str(exc)}",
            "type": type(exc).__name__,
            "path": path,
        },
        headers=_get_cors_headers(request),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    method = getattr(request, "method", "WEBSOCKET")
    url = getattr(request, "url", None)
    path = getattr(url, "path", "") if url else ""
    print(f" [HTTP EXCEPTION {exc.status_code}] {method} {path}: {exc.detail}", file=sys.stderr)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=_get_cors_headers(request),
    )

@app.get("/health")
@app.get("/api/health")
def health_check():
    """Health check endpoint providing MongoDB connectivity and server diagnostics."""
    from modules.shared.config import get_active_cluster, get_mongodb_url_for_cluster
    active_cluster = get_active_cluster()
    url = get_mongodb_url_for_cluster(active_cluster)
    cluster_host = "unknown"
    if "@" in url:
        cluster_host = url.split("@")[-1].split("/")[0].split("?")[0]

    db_status = "unknown"
    db_error = None
    try:
        from modules.shared.db import db as mongo_db
        mongo_db.command("ping")
        db_status = "connected"
    except Exception as err:
        db_status = "error"
        db_error = str(err)
        print(f" [HEALTH CHECK MONGO ERROR]: {err}", file=sys.stderr)

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "database_cluster": cluster_host,
        "active_cluster": active_cluster,
        "database_error": db_error,
        "environment": os.getenv("VERCEL_ENV", "local"),
        "vercel_url": os.getenv("VERCEL_URL", ""),
        "vercel_git_commit_ref": os.getenv("VERCEL_GIT_COMMIT_REF", ""),
        "git_commit": os.getenv("VERCEL_GIT_COMMIT_SHA", "")[:7],
    }

app.include_router(identity_router, prefix="/api/auth")
app.include_router(identity_router, prefix="/auth")
app.include_router(candidate_router)
app.include_router(candidate_router, prefix="/api")
app.include_router(calendar_router, prefix="/api", tags=["Calendar"])
app.include_router(resume_screener_router, prefix="/api", tags=["Resume Screener"])
app.include_router(interview_router, prefix="/api", tags=["Interviews"])
app.include_router(onboarding_router, tags=["Onboarding"])
app.include_router(notifications_router)
app.include_router(onboarding_router)
app.include_router(candidate_portal_router)
app.include_router(workforce_router, prefix="/api", tags=["Workforce"])
app.include_router(workforce_router, tags=["Workforce"])
app.include_router(workorder_router)
app.include_router(superadmin_agent_router)
app.include_router(company_admin_agent_router)
app.include_router(hiring_manager_agent_router)
app.include_router(vendor_billing_router)
app.include_router(voice_router)
app.include_router(offboarding_router, tags=["Offboarding"])
from modules.waitlist.router import router as waitlist_router
app.include_router(waitlist_router)
app.include_router(candidate_profile_router)
app.include_router(zoho_cliq_router)
app.include_router(integrations_router)
app.include_router(telegram_bot_router)
app.include_router(teams_bot_router)
app.include_router(team_chat_router)
app.include_router(backup_router)
app.include_router(backup_router, prefix="/api/admin")
app.include_router(backup_router, prefix="/api/auth")

# Reload trigger for interview module updates

# --- LLM provider selection -------------------------------------------------
def _build_service():
    from modules.requisition.agent.graph import make_checkpointer
    from modules.requisition.llm.groq import GroqClient
    from modules.requisition.llm.mock import MockLLM
    from modules.requisition.services.requisition_service import RequisitionService

    provider = os.getenv("LLM_PROVIDER", "groq").lower()
    llm = GroqClient() if provider == "groq" else MockLLM()
    return RequisitionService(
        llm=llm,
        session_factory=get_session,
        checkpointer=make_checkpointer(),
    )


service = _build_service()
if not bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")):
    try:
        init_db()
        try:
            from scripts.seed_super_admin import seed_super_admin
            if os.getenv("TERMJOBS_PRESERVE_SUPER_ADMIN") != "1":
                seed_super_admin()
        except Exception as s_exc:
            import logging
            logging.getLogger("uvicorn.error").warning("seed_super_admin error: %s", s_exc)
    except Exception as exc:  # noqa: BLE001
        import logging

        logging.getLogger("uvicorn.error").warning(
            "init_db failed (MongoDB unreachable?): %s", exc
        )



# --- request/response models ------------------------------------------------
class CompanyProfileIn(BaseModel):
    name: str
    industry: str = ""
    size: str = ""
    location: str = ""
    tech_stack: list[str] = Field(default_factory=list)
    notes: str = ""


class RequisitionIn(BaseModel):
    company_profile_id: str | None = None
    title: str = ""
    description: str = ""
    tech_stack_hint: list[str] = Field(default_factory=list)
    prompt: str = ""
    created_by: str | None = None
    # Stage-1 intake (tabbed intake flow)
    intake_mode: str = "guided"  # guided | paste | upload
    background_profile_id: str | None = None
    reference_documents: list[str] = Field(default_factory=list)
    context_notes: str = ""
    source_filename: str = ""  # uploaded source document name
    # Pre-filled structured role fields (optional, all 6 tabs)
    prefill: dict | None = None

    @field_validator("prefill")
    @classmethod
    def validate_deadline(cls, value):
        validate_submission_deadline((value or {}).get("submission_deadline"))
        start_date = (value or {}).get("start_date")
        if str(start_date or "").strip().lower() not in {"to be confirmed", "tbd"}:
            validate_start_date(start_date)
        return value


class AnswerIn(BaseModel):
    answer: str


class RefineIn(BaseModel):
    instruction: str


class ApproveIn(BaseModel):
    reviewer: str | None = None
    edited_role: dict | None = None

    @field_validator("edited_role")
    @classmethod
    def validate_deadline(cls, value):
        validate_submission_deadline((value or {}).get("submission_deadline"))
        return value


class RejectIn(BaseModel):
    reviewer: str | None = None
    reason: str | None = None


class ApproveByIn(BaseModel):
    by: str | None = None


class CandidateLimitIn(BaseModel):
    limit: int = Field(ge=1, le=100)


class RoleTemplateCreateIn(BaseModel):
    name: str = Field(..., description="Template display name")
    title: str | None = Field(default=None, description="Job title")
    description: str | None = Field(default="", description="Role summary / description")
    job_family: str | None = Field(default="", description="Department or job family")
    must_have_skills: list[str] | str | None = Field(default=None, description="Mandatory skills")
    nice_to_have_skills: list[str] | str | None = Field(default=None, description="Nice-to-have skills")
    experience: str | None = Field(default="", description="Experience band (e.g. 5-8 years)")
    headcount: int | None = Field(default=1, description="Number of openings")
    certifications: list[str] | str | None = Field(default=None, description="Certifications")
    engagement_type: str | None = Field(default="Contract", description="Engagement type")
    duration: str | None = Field(default="", description="Contract duration")
    extension_likely: bool | str | None = Field(default=False, description="Extension likely")
    rate_basis: str | None = Field(default="Hourly", description="Rate basis")
    budget_cap_currency: str | None = Field(default="INR", description="Currency")
    vendor_floor: int | float | None = Field(default=None, description="Min vendor rate")
    vendor_cap: int | float | None = Field(default=None, description="Max vendor rate")
    ceiling_internal: int | float | None = Field(default=None, description="Internal rate ceiling")
    work_mode: str | None = Field(default="Remote", description="Work mode")
    primary_location: str | None = Field(default="", description="Primary location")
    equipment_provided: str | None = Field(default="", description="Equipment provisioning")
    bgv_required: str | None = Field(default="", description="Background verification level")
    nda_required: str | bool | None = Field(default="", description="NDA required")
    priority: str | None = Field(default="Normal", description="Priority level")
    tenant_id: str | None = Field(default=None, description="Target buyer company tenant ID")
    structured_role: dict | None = Field(default=None, description="Optional raw structured role")


# --- serialization helpers --------------------------------------------------
def _company_dict(prof: models.CompanyProfile) -> dict:
    return {
        "id": prof.id,
        "tenant_id": prof.tenant_id,
        "name": prof.name,
        "industry": prof.industry,
        "location": prof.location,
        "tech_stack": prof.tech_stack or [],
    }


INTERNAL_ROLE_KEYS = {
    "ceiling_internal",
    "rate_card_cap",
    "total_engagement_value",
    "cost_centre",
    "budget_approved",
    "budget_reference",
    "variance_approved",
}


def _num(val: Any) -> int | None:
    if val in (None, ""):
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _strip_internal_role(role: Any) -> Any:
    """Remove internal-only commercial fields before a vendor sees a role.

    ``ceiling_internal`` must never reach a vendor-facing response; only
    ``range_vendors_see`` is published to consultancies.
    """
    if not isinstance(role, dict):
        return role
    return {k: v for k, v in role.items() if k not in INTERNAL_ROLE_KEYS}


def _format_datetime(val: Any) -> str | None:
    if not val:
        return None
    if hasattr(val, "isoformat"):
        if getattr(val, "tzinfo", None) is None:
            val = val.replace(tzinfo=timezone.utc)
        return val.isoformat()
    if isinstance(val, str):
        val_str = val.strip()
        if not val_str:
            return None
        if "T" in val_str and not val_str.endswith("Z") and "+" not in val_str and not (len(val_str) > 19 and "-" in val_str[10:]):
            return val_str + "Z"
        return val_str
    return str(val)


def _add_48h(dt_val: Any) -> str | None:
    if not dt_val:
        return None
    if isinstance(dt_val, str):
        try:
            s = dt_val.strip()
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            dt_val = datetime.fromisoformat(s)
        except Exception:
            return None
    try:
        if dt_val.tzinfo is None:
            dt_val = dt_val.replace(tzinfo=timezone.utc)
        return (dt_val + timedelta(hours=48)).isoformat()
    except Exception:
        return None


def _requisition_dict(requisition_id: str, for_vendor: bool = False) -> dict:
    with get_session() as session:
        req = session.get(models.Requisition, requisition_id)
        if req is None:
            raise HTTPException(status_code=404, detail="requisition not found")
        company = None
        if req.company_profile_id:
            prof = session.get(models.CompanyProfile, req.company_profile_id)
            if prof:
                company = _company_dict(prof)
        from modules.requisition.services.submitter import requisition_submitters
        submitter = requisition_submitters(session, [req]).get(req.id, {}) if not for_vendor else {}
        creator = None
        if getattr(req, "created_by", None):
            try:
                creator = session.get(User, req.created_by)
            except Exception:
                pass
        creator_name = (getattr(creator, "name", None) or submitter.get("hiring_manager_name") or "").strip()
        sr = dict(req.structured_role or {})
        raw_hm = (sr.get("hiring_manager") or "").strip()
        hm_name = raw_hm if (raw_hm and raw_hm.lower() not in ("assigned hiring manager", "hiring manager", "hm")) else (creator_name or raw_hm or "")
        if hm_name and (not sr.get("hiring_manager") or str(sr.get("hiring_manager")).lower() in ("assigned hiring manager", "hiring manager", "hm")):
            sr["hiring_manager"] = hm_name
        v_limit = (
            _num((req.intake_meta or {}).get("prefill", {}).get("vendor_candidate_limit"))
            or _num((req.intake_meta or {}).get("prefill", {}).get("candidate_limit"))
            or _num(sr.get("vendor_candidate_limit"))
            or _num(req.vendor_candidate_limit)
            or _num(sr.get("headcount"))
            or 1
        )
        if sr:
            sr["vendor_candidate_limit"] = v_limit
        if for_vendor:
            sr = _strip_internal_role(sr)

        # Get engaged vendor consultancies receiving this published requisition
        published_vendors = []
        if req.tenant_id:
            engagements = (
                session.query(VendorEngagement)
                .filter(VendorEngagement.tenant_id == req.tenant_id)
                .all()
            )
            vendor_tenant_ids = [e.vendor_tenant_id for e in engagements]
            if vendor_tenant_ids:
                vendors = (
                    session.query(Tenant)
                    .filter(Tenant.id.in_(vendor_tenant_ids))
                    .all()
                )
                published_vendors = [
                    {
                        "id": v.id,
                        "name": v.name,
                        "tenant_type": getattr(v, "tenant_type", "vendor") or "vendor",
                        "status": "Published & Active",
                    }
                    for v in vendors
                ]

        cand_list = []
        try:
            from modules.shared.db import db
            cand_list = list(db["candidate_submissions"].find({"requisition_id": str(req.id)}))
        except Exception:
            pass

        applicant_count = len(cand_list)
        shortlisted_count = sum(1 for c in cand_list if (c.get("status") or "").lower() == "shortlisted")
        in_interview_count = sum(
            1 for c in cand_list if (c.get("status") or "").lower() in ("interview", "interviewing", "interview scheduled", "in interview", "scheduled")
        )
        hired_count = sum(
            1 for c in cand_list if (c.get("status") or "").lower() in ("accepted", "hired", "offer extended", "offer accepted", "completed")
        )

        return {
            "id": req.id,
            "ref": f"REQ-{req.id[:6].upper()}",
            "tenant_id": req.tenant_id,
            "company_profile_id": req.company_profile_id,
            "company": company,
            "company_name": (company.get("name") if isinstance(company, dict) else getattr(company, "name", None)) or getattr(req, "company_name", None) or "",
            "status": req.status,
            "title": req.title,
            "department": getattr(req, "department", None) or sr.get("department") or sr.get("job_family") or "",
            "job_family": sr.get("job_family") or getattr(req, "job_family", None) or "",
            "experience": sr.get("experience") or sr.get("experience_range") or sr.get("experience_level") or "",
            "experience_range": sr.get("experience_range") or sr.get("experience") or sr.get("experience_level") or "",
            "location": sr.get("primary_location") or sr.get("workplace_type") or "",
            "primary_location": sr.get("primary_location") or "",
            "workplace_type": sr.get("workplace_type") or sr.get("work_mode") or "",
            "skills": getattr(req, "skills", None) or sr.get("must_have_skills") or sr.get("primary_skills") or [],
            "description": getattr(req, "description", None) or sr.get("summary") or sr.get("role_overview") or (req.intent or {}).get("description") or "",
            "applicant_count": applicant_count,
            "shortlisted_count": shortlisted_count,
            "in_interview_count": in_interview_count,
            "hired_count": hired_count,
            "intent": req.intent,
            "intake_answers": req.intake_answers,
            "pending_question": req.pending_question,
            "created_by": getattr(req, "created_by", None),
            "created_by_name": creator_name,
            "structured_role": sr,
            "vendor_candidate_limit": v_limit,
            "published_vendors": published_vendors,
            **submitter,
            "hiring_manager_name": hm_name or submitter.get("hiring_manager_name") or sr.get("hiring_manager") or "",
            "generated_jd_markdown": req.generated_jd_markdown,
            "coverage_result": req.coverage_result,
            "refinement_log": req.refinement_log or [],
            "intake_meta": req.intake_meta or {},
            "director_approved": bool(getattr(req, "director_approved", False)),
            "director_approved_by": getattr(req, "director_approved_by", None),
            "director_approved_at": _format_datetime(getattr(req, "director_approved_at", None)),
            "rejection_reason": getattr(req, "rejection_reason", None),
            "rejected_by": getattr(req, "rejected_by", None),
            "rejected_at": _format_datetime(getattr(req, "rejected_at", None)),
            "approved_by": req.approved_by,
            "approved_at": _format_datetime(req.approved_at),
            "created_at": _format_datetime(req.created_at),
            "shortlist_window_hours": getattr(req, "shortlist_window_hours", 48) or 48,
            "shortlist_deadline": _format_datetime(getattr(req, "shortlist_deadline", None)) or _add_48h(req.approved_at or req.created_at),
            "shortlist_dispatched": bool(getattr(req, "shortlist_dispatched", False)),
            "shortlist_dispatched_at": _format_datetime(getattr(req, "shortlist_dispatched_at", None)),
            "shortlist_dispatched_by": getattr(req, "shortlist_dispatched_by", None),
            "shortlist_auto_sent": bool(getattr(req, "shortlist_auto_sent", False)),
            "shortlist_instant_sent": bool(getattr(req, "shortlist_instant_sent", False)),
            "shortlist_candidate_count": getattr(req, "shortlist_candidate_count", 0) or 0,
        }


def _interrupt_payload(state: dict, interrupt: Any) -> dict:
    """Normalise an agent result into a consumer-friendly checkpoint."""
    payload: dict[str, Any] = {"status": state.get("status")}
    if isinstance(interrupt, str):
        payload["type"] = "intake_question"
        payload["question"] = interrupt
    elif isinstance(interrupt, dict) and interrupt.get("checkpoint") == "approval":
        payload["type"] = "approval"
        payload["structured_role"] = interrupt.get("structured_role")
        payload["generated_jd_markdown"] = interrupt.get("jd_markdown")
    else:
        payload["type"] = "completed"
    return payload


def _get_requisition(requisition_id: str) -> models.Requisition:
    with get_session() as session:
        req = session.get(models.Requisition, requisition_id)
    if req is None:
        raise HTTPException(status_code=404, detail="requisition not found")
    return req


def _require_tenant(req: models.Requisition, current_user: User) -> models.Requisition:
    """Raise 403 unless the requester belongs to the requisition's tenant (Super Admin sees all)."""
    if current_user.role == "Super Admin":
        return req
    if req.tenant_id == current_user.tenant_id:
        # Hiring Manager can only access requisitions they created
        if current_user.role == "Hiring Manager" and req.created_by and req.created_by != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this requisition",
            )
        return req
    # Vendors may view requisitions of companies that engaged them.
    if current_user.role == "Recruiter":
        from modules.identity.domain.models import VendorEngagement

        with get_session() as session:
            engaged = session.query(VendorEngagement).filter(
                VendorEngagement.vendor_tenant_id == current_user.tenant_id,
                VendorEngagement.tenant_id == req.tenant_id,
            ).first()
        if engaged:
            return req
    raise HTTPException(
        status_code=403,
        detail="You do not have access to this requisition",
    )


def _require_writable(current_user: User) -> None:
    """Raise 403 for read-only roles (Director) on mutation endpoints."""
    if str(current_user.role or "").strip().lower() == "director":
        raise HTTPException(
            status_code=403,
            detail="Directors have read-only access",
        )


_auto_close_last_run: float = 0.0  # module-level debounce


def _auto_close_expired() -> None:
    """Close expired approval queues and published roles before serving cached lists."""
    global _auto_close_last_run
    import time as _time
    from datetime import datetime
    from zoneinfo import ZoneInfo
    today = datetime.now(ZoneInfo('Asia/Kolkata')).date()
    now = _time.time()
    last_day = datetime.fromtimestamp(_auto_close_last_run, ZoneInfo('Asia/Kolkata')).date()
    if now - _auto_close_last_run < 300 and today == last_day:
        return
    changed = False
    with get_session() as session:
        rows = session.query(models.Requisition).filter(models.Requisition.status.in_(
            ['Published', 'Active', 'Approved', 'PendingApproval', 'Pending Approval', 'Pending_Approval', 'pending_approval']
        )).all()
        for req in rows:
            role = req.structured_role or (req.intake_meta or {}).get('prefill') or {}
            ends_on = role.get('ends_on')
            if submission_deadline_passed(role, today) or submission_deadline_passed({'submission_deadline': ends_on}, today):
                req.status = schemas.RequisitionStatus.CLOSED.value
                req.updated_at = _utcnow()
                changed = True
        if changed:
            session.commit()
            _cache.clear()
    _auto_close_last_run = now


def _require_approval_deadline(requisition_id, *, allow_resubmission=False):
    with get_session() as session:
        req = session.get(models.Requisition, requisition_id)
        if not req:
            raise HTTPException(status_code=404, detail='Requisition not found')
        try:
            enforce_approval_deadline(session, req, allow_resubmission=allow_resubmission)
        except DeadlineExpired as exc:
            _cache.clear()
            raise HTTPException(status_code=409, detail=str(exc)) from exc


def _auto_check_shortlists_48h() -> None:
    """Auto-dispatch 48h candidate shortlists for requisitions whose sourcing window has passed."""
    try:
        from modules.candidate.shortlist_service import auto_check_and_dispatch_48h_shortlists
        auto_check_and_dispatch_48h_shortlists()
    except Exception as e:
        pass



# --- company profile endpoints ----------------------------------------------
@app.post("/company-profiles", status_code=201)
@app.post("/api/company-profiles", status_code=201)
def create_company_profile(body: CompanyProfileIn, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)

    with get_session() as session:
        prof = models.CompanyProfile(**body.model_dump(), tenant_id=current_user.tenant_id)
        session.add(prof)
        session.commit()
        session.refresh(prof)
        return {"id": prof.id, "name": prof.name, "tenant_id": prof.tenant_id}


@app.get("/company-profiles")
@app.get("/api/company-profiles")
def list_company_profiles(current_user: User = Depends(get_current_user)) -> list[dict]:
    with get_session() as session:
        query = session.query(models.CompanyProfile).order_by(models.CompanyProfile.created_at.desc())
        if current_user.role != "Super Admin":
            query = query.filter(models.CompanyProfile.tenant_id == current_user.tenant_id)
        rows = query.all()
        return [_company_dict(r) for r in rows]


# --- platform settings endpoints ---------------------------------------------
@app.get("/api/settings/candidate-limit")
def get_candidate_limit(current_user: User = Depends(get_current_user)) -> dict:
    from modules.shared.settings import get_max_candidates_per_requisition

    return {"limit": get_max_candidates_per_requisition()}


@app.put("/api/settings/candidate-limit")
def set_candidate_limit(body: CandidateLimitIn, current_user: User = Depends(get_current_user)) -> dict:
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can change platform settings")

    from modules.shared.settings import set_max_candidates_per_requisition

    return {"limit": set_max_candidates_per_requisition(body.limit)}


# --- role template endpoints -------------------------------------------------
def _template_dict(t: models.RoleTemplate) -> dict:
    return {
        "id": t.id,
        "tenant_id": t.tenant_id,
        "name": t.name,
        "description": t.description,
        "structured_role": t.structured_role,
        "created_at": _format_datetime(t.created_at),
    }


@app.post("/templates/create", status_code=201)
@app.post("/api/templates/create", status_code=201)
@app.post("/templates/form", status_code=201)
@app.post("/api/templates/form", status_code=201)
def create_template_from_form(
    payload: RoleTemplateCreateIn,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a standardized role template directly from form details (Director or Super Admin).
    Strictly scopes template to the target buyer company tenant to prevent cross-tenant data leaks.
    """
    if current_user.role not in ("Director", "Admin", "Super Admin"):
        raise HTTPException(
            status_code=403,
            detail="Only Directors or Administrators can create role templates"
        )

    user_tenant = getattr(current_user, "tenant_id", None) or ""
    user_id = getattr(current_user, "id", None) or "director"

    # Multi-tenant security check
    target_tenant_id = user_tenant
    if current_user.role == "Super Admin":
        target_tenant_id = (payload.tenant_id or user_tenant or "platform").strip()
    else:
        if payload.tenant_id and payload.tenant_id.strip() != user_tenant:
            raise HTTPException(
                status_code=403,
                detail="You can only assign role templates to your own buyer company."
            )

    with get_session() as session:
        if not target_tenant_id or target_tenant_id in ("local", "platform", ""):
            db_user = session.query(User).filter(User.id == current_user.id).first()
            if db_user and db_user.tenant_id and db_user.tenant_id not in ("local", "platform", ""):
                target_tenant_id = db_user.tenant_id
            else:
                if current_user.role != "Super Admin":
                    raise HTTPException(
                        status_code=400,
                        detail="User must belong to a valid buyer company tenant to create templates."
                    )
                target_tenant_id = user_tenant or "platform"

        def _parse_list(val):
            if isinstance(val, list):
                return [str(x).strip() for x in val if str(x).strip()]
            if isinstance(val, str):
                return [s.strip() for s in val.split(",") if s.strip()]
            return []

        skills_must = _parse_list(payload.must_have_skills)
        skills_nice = _parse_list(payload.nice_to_have_skills)
        certs = _parse_list(payload.certifications)

        vendor_range = None
        if payload.vendor_floor is not None and payload.vendor_cap is not None:
            vendor_range = [payload.vendor_floor, payload.vendor_cap]
        elif payload.vendor_cap is not None:
            vendor_range = [0, payload.vendor_cap]

        role_title = (payload.title or payload.name or "").strip()
        if not role_title:
            role_title = "Untitled Role Template"

        base_structured_role = dict(payload.structured_role or {})
        structured_role = {
            **base_structured_role,
            "title": role_title,
            "job_family": payload.job_family or base_structured_role.get("job_family") or "",
            "department": payload.job_family or base_structured_role.get("department") or "",
            "must_have_skills": skills_must or base_structured_role.get("must_have_skills") or [],
            "nice_to_have_skills": skills_nice or base_structured_role.get("nice_to_have_skills") or [],
            "experience": payload.experience or base_structured_role.get("experience") or "",
            "experience_band": payload.experience or base_structured_role.get("experience_band") or "",
            "headcount": payload.headcount or base_structured_role.get("headcount") or 1,
            "certifications": certs or base_structured_role.get("certifications") or [],
            "engagement_type": payload.engagement_type or base_structured_role.get("engagement_type") or "Contract",
            "duration": payload.duration or base_structured_role.get("duration") or "",
            "extension_likely": bool(payload.extension_likely) if payload.extension_likely is not None else base_structured_role.get("extension_likely", False),
            "rate_basis": payload.rate_basis or base_structured_role.get("rate_basis") or "Hourly",
            "budget_cap_currency": payload.budget_cap_currency or base_structured_role.get("budget_cap_currency") or "INR",
            "vendor_floor": payload.vendor_floor if payload.vendor_floor is not None else base_structured_role.get("vendor_floor"),
            "vendor_cap": payload.vendor_cap if payload.vendor_cap is not None else base_structured_role.get("vendor_cap"),
            "ceiling_internal": payload.ceiling_internal if payload.ceiling_internal is not None else base_structured_role.get("ceiling_internal"),
            "rate_band": vendor_range or base_structured_role.get("rate_band"),
            "range_vendors_see": vendor_range or base_structured_role.get("range_vendors_see"),
            "work_mode": payload.work_mode or base_structured_role.get("work_mode") or "Remote",
            "primary_location": payload.primary_location or base_structured_role.get("primary_location") or "",
            "equipment_provided": payload.equipment_provided or base_structured_role.get("equipment_provided") or "",
            "equipment_provisioning": payload.equipment_provided or base_structured_role.get("equipment_provisioning") or "",
            "bgv_required": str(payload.bgv_required or base_structured_role.get("bgv_required") or ""),
            "background_check": str(payload.bgv_required or base_structured_role.get("background_check") or ""),
            "nda_required": "Yes" if payload.nda_required in (True, "Yes", "yes") else (base_structured_role.get("nda_required") or ""),
            "priority": payload.priority or base_structured_role.get("priority") or "Normal",
            "notes": payload.description or base_structured_role.get("notes") or "",
        }

        tpl_name = (payload.name or role_title).strip()
        tpl = models.RoleTemplate(
            tenant_id=target_tenant_id,
            created_by=user_id,
            name=tpl_name,
            description=payload.description or "",
            structured_role=structured_role,
        )
        session.add(tpl)
        session.commit()
        session.refresh(tpl)

        try:
            from modules.shared.db import db as mongo_db
            mongo_db["role_templates"].update_one(
                {"id": tpl.id},
                {"$set": {
                    "id": tpl.id,
                    "tenant_id": target_tenant_id,
                    "created_by": user_id,
                    "name": tpl.name,
                    "description": tpl.description or "",
                    "structured_role": structured_role,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
        except Exception:
            pass

        return _template_dict(tpl)


@app.post("/templates/seed-presets", status_code=200)
@app.post("/api/templates/seed-presets", status_code=200)
def seed_role_templates_preset(
    tenant_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Seed standard 9 pre-approved role templates for the director's company tenant."""
    if current_user.role not in ("Director", "Admin", "Super Admin"):
        raise HTTPException(status_code=403, detail="Only Directors or Admins can seed standard role templates")

    target_tenant = tenant_id if (current_user.role == "Super Admin" and tenant_id) else (current_user.tenant_id or "5539fe83-b044-48a5-8711-4e811f4f9a1c")
    user_id = getattr(current_user, "id", None) or "director"

    from modules.requisition.domain.template_presets import STANDARD_ROLE_PRESETS

    with get_session() as session:
        created_count = 0
        updated_count = 0
        for t_data in STANDARD_ROLE_PRESETS:
            name = t_data["name"]
            title = t_data["title"]
            skills_must = t_data["must_have_skills"]
            skills_nice = t_data["nice_to_have_skills"]
            certs = t_data["certifications"]
            vendor_range = [t_data["vendor_floor"], t_data["vendor_cap"]]

            structured_role = {
                "title": title,
                "job_family": t_data["job_family"],
                "department": t_data["job_family"],
                "must_have_skills": skills_must,
                "nice_to_have_skills": skills_nice,
                "experience": t_data["experience"],
                "experience_band": t_data["experience"],
                "headcount": t_data["headcount"],
                "certifications": certs,
                "engagement_type": t_data["engagement_type"],
                "duration": t_data["duration"],
                "extension_likely": True,
                "rate_basis": t_data["rate_basis"],
                "budget_cap_currency": t_data["budget_cap_currency"],
                "vendor_floor": t_data["vendor_floor"],
                "vendor_cap": t_data["vendor_cap"],
                "ceiling_internal": t_data["ceiling_internal"],
                "rate_band": vendor_range,
                "range_vendors_see": vendor_range,
                "work_mode": t_data["work_mode"],
                "primary_location": t_data["primary_location"],
                "equipment_provided": t_data["equipment_provided"],
                "equipment_provisioning": t_data["equipment_provided"],
                "bgv_required": t_data["bgv_required"],
                "background_check": t_data["bgv_required"],
                "nda_required": t_data["nda_required"],
                "priority": t_data["priority"],
                "notes": t_data["description"],
            }

            existing = session.query(models.RoleTemplate).filter(
                models.RoleTemplate.tenant_id == target_tenant,
                models.RoleTemplate.name == name
            ).first()

            if existing:
                existing.structured_role = structured_role
                existing.description = t_data["description"]
                existing_id = existing.id
                updated_count += 1
            else:
                new_tpl = models.RoleTemplate(
                    tenant_id=target_tenant,
                    created_by=user_id,
                    name=name,
                    description=t_data["description"],
                    structured_role=structured_role,
                )
                session.add(new_tpl)
                session.flush()
                existing_id = new_tpl.id
                created_count += 1

            try:
                from modules.shared.db import db as mongo_db
                mongo_db["role_templates"].update_one(
                    {"id": existing_id},
                    {"$set": {
                        "id": existing_id,
                        "tenant_id": target_tenant,
                        "created_by": user_id,
                        "name": name,
                        "description": t_data["description"],
                        "structured_role": structured_role,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
            except Exception:
                pass

        session.commit()
    return {
        "status": "success",
        "created": created_count,
        "updated": updated_count,
        "total": len(STANDARD_ROLE_PRESETS)
    }



@app.post("/templates", status_code=201)
@app.post("/api/templates", status_code=201)
async def upload_template(
    file: UploadFile = File(...),
    tenant_id: str | None = Form(default=None),
    company_name: str | None = Form(default=None),
    query_tenant_id: str | None = Query(default=None, alias="tenant_id"),
    current_user: User = Depends(get_current_user),
):
    """Upload a JSON role template (director-defined) that hiring managers can
    use to pre-fill the New Requisition form.

    Accepts a single template or a ``{"templates": [...]}`` bundle or an array of templates.
    Strictly scopes templates to the target buyer company tenant to prevent cross-company data leakage.
    """
    # 1. Flexible filename and mime type check (many browsers send application/octet-stream or text/plain for .json files)
    is_json_ext = bool(file.filename and file.filename.lower().endswith(".json"))
    is_json_mime = (
        file.content_type in (
            "application/json", "text/json", "text/plain", "application/octet-stream",
            "application/x-javascript", "text/javascript", None, ""
        )
    )
    if not (is_json_ext or is_json_mime):
        raise HTTPException(status_code=400, detail="Template must be a JSON file (.json)")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded template file is empty")

    # 2. Resilient decoding (handles UTF-8 BOM, standard UTF-8, and fallback)
    try:
        text_content = content.decode("utf-8-sig")
    except Exception:
        try:
            text_content = content.decode("utf-8", errors="replace")
        except Exception:
            text_content = content.decode("latin-1", errors="replace")

    try:
        payload = json.loads(text_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Template file contains invalid JSON: {str(e)}")

    # 3. Flexible payload structure: list of templates, bundle object, or single template object
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        bundle = (
            payload.get("templates") or
            payload.get("roles") or
            payload.get("items") or
            payload.get("data")
        )
        items = bundle if isinstance(bundle, list) else [payload]
    else:
        raise HTTPException(status_code=400, detail="Template JSON must be an object or array of template objects")

    created = []
    user_id = getattr(current_user, "id", None) or "director"
    user_tenant = getattr(current_user, "tenant_id", None) or ""

    # Determine default tenant for this upload batch
    clean_tenant_id = tenant_id if isinstance(tenant_id, str) else None
    clean_query_tenant_id = query_tenant_id if isinstance(query_tenant_id, str) else None
    clean_company_name = company_name if isinstance(company_name, str) else None
    target_tenant_id = (clean_tenant_id or clean_query_tenant_id or "").strip()
    target_company = (clean_company_name or "").strip()
    if isinstance(payload, dict):
        if not target_tenant_id:
            target_tenant_id = str(payload.get("tenant_id") or payload.get("target_tenant_id") or "").strip()
        if not target_company:
            target_company = str(payload.get("company_name") or payload.get("company") or payload.get("buyer_company") or "").strip()

    with get_session() as session:
        # Resolve company name to tenant_id if provided
        if not target_tenant_id and target_company:
            matched_tenant = session.query(Tenant).filter(
                Tenant.name.ilike(target_company),
                Tenant.is_deleted == False
            ).first()
            if matched_tenant:
                target_tenant_id = matched_tenant.id

        # Multi-tenant security check:
        # Super Admin can assign templates to any tenant.
        # Other roles (Director, Admin, etc.) can ONLY upload to their own company tenant.
        if current_user.role != "Super Admin":
            if target_tenant_id and target_tenant_id != user_tenant:
                raise HTTPException(
                    status_code=403,
                    detail="You can only assign role templates to your own buyer company."
                )
            target_tenant_id = user_tenant

        if not target_tenant_id or target_tenant_id in ("local", "platform", ""):
            db_user = session.query(User).filter(User.id == current_user.id).first()
            if db_user and db_user.tenant_id and db_user.tenant_id not in ("local", "platform", ""):
                target_tenant_id = db_user.tenant_id
            else:
                if current_user.role != "Super Admin":
                    raise HTTPException(status_code=400, detail="User must belong to a valid buyer company tenant to upload templates.")
                target_tenant_id = user_tenant or "platform"

        for item in items:
            if not isinstance(item, dict):
                continue

            item_tenant_id = target_tenant_id
            item_company = str(item.get("company") or item.get("company_name") or item.get("buyer_company") or "").strip()
            item_custom_tenant = str(item.get("tenant_id") or "").strip()

            if current_user.role == "Super Admin":
                if item_custom_tenant:
                    item_tenant_id = item_custom_tenant
                elif item_company:
                    t = session.query(Tenant).filter(Tenant.name.ilike(item_company), Tenant.is_deleted == False).first()
                    if t:
                        item_tenant_id = t.id

            role, name, description = _template_role(item)
            title = (
                (role or {}).get("title") or
                (role or {}).get("job_title") or
                (role or {}).get("role_title") or
                item.get("title") or
                item.get("job_title") or
                item.get("position_name") or
                item.get("name") or
                item.get("position") or
                item.get("role_title") or
                name
            )
            if not title:
                title = "Untitled Role Template"

            if isinstance(role, dict):
                role["title"] = title

            tpl_name = name or f"Template – {title}"
            tpl = models.RoleTemplate(
                tenant_id=item_tenant_id,
                created_by=user_id,
                name=tpl_name,
                description=description or "",
                structured_role=role,
            )
            session.add(tpl)
            created.append(tpl)

            # Also mirror in MongoDB role_templates collection for high availability
            try:
                from modules.shared.db import db as mongo_db
                mongo_db["role_templates"].update_one(
                    {"id": tpl.id},
                    {"$set": {
                        "id": tpl.id,
                        "tenant_id": item_tenant_id,
                        "created_by": user_id,
                        "name": tpl_name,
                        "description": description or "",
                        "structured_role": role,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
            except Exception:
                pass

        if not created:
            raise HTTPException(status_code=400, detail="No valid templates found in the JSON file")
        session.commit()
        for tpl in created:
            session.refresh(tpl)

    result = [_template_dict(t) for t in created]
    return result if len(result) > 1 else result[0]


def _template_role(item: dict) -> tuple[dict, str, str]:
    """Extract a canonical ``structured_role`` dict + name + description from an
    uploaded template item, supporting several input shapes."""
    name = item.get("name") or item.get("position_name") or ""
    description = item.get("description") or ""

    # 1) Internal shape: { "structured_role": {...}, "name": ... }
    if isinstance(item.get("structured_role"), dict):
        return item["structured_role"], name, description

    # 2) Director's flat shape with nested sections
    if isinstance(item.get("role"), dict):
        return _normalize_template(item), name, description

    # 3) Bare structured_role dict
    return dict(item), name, description


def _normalize_template(payload: dict) -> dict:
    """Normalise the director's flat JSON format into the internal
    ``structured_role`` shape consumed by the New Requisition prefill."""
    role_src = payload.get("role") or {}
    eng = payload.get("engagement") or {}
    com = payload.get("commercials") or {}
    ws = payload.get("work_setup") or {}
    comp = payload.get("compliance") or {}
    proc = payload.get("process") or {}

    title = role_src.get("job_title") or payload.get("position_name") or payload.get("title")

    certs_raw = role_src.get("certifications") or ""
    certifications = (
        [c.strip() for c in certs_raw.split(",") if c.strip()]
        if isinstance(certs_raw, str) and certs_raw
        else (certs_raw or [])
    )

    extension_likely = str(eng.get("extension_likely") or "").lower() in ("yes", "maybe", "true", "1")

    try:
        on_days = int(ws.get("onsite_days_per_week") or 0)
    except (TypeError, ValueError):
        on_days = 0

    shift = str(ws.get("shift") or "")
    if ws.get("on_call"):
        shift = (shift + ", " if shift else "") + "on-call rotation"

    bg_level = str(comp.get("background_check_level") or "")

    laptop = str(comp.get("laptop_provided_by") or "")
    equipment = (
        "Vendor-provided"
        if laptop.lower() == "vendor"
        else "Company-provided"
        if laptop.lower() == "client"
        else ""
    )

    priority = str(proc.get("priority") or "Normal")
    if priority.lower() == "critical":
        priority = "High"

    notes = ", ".join(
        x
        for x in [
            str(com.get("rate_basis") or ""),
            str(com.get("currency") or ""),
            f"SLA {proc.get('first_submission_sla_hours')}h" if proc.get("first_submission_sla_hours") else "",
            f"max {proc.get('max_submissions_per_vendor')} subs/vendor" if proc.get("max_submissions_per_vendor") else "",
            f"BGV paid by {comp.get('bgv_paid_by')}" if comp.get("bgv_paid_by") else "",
        ]
        if x
    )

    def _num(v):
        if v in (None, ""):
            return None
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return None

    ceiling = _num(com.get("ceiling_internal") if "ceiling_internal" in com else com.get("internal_ceiling"))
    cap = _num(com.get("rate_card_cap") if "rate_card_cap" in com else com.get("rate_card_cap") or com.get("cap"))

    min_v = _num(com.get("range_vendors_see_min") if "range_vendors_see_min" in com else com.get("vendor_range_min"))
    max_v = _num(com.get("range_vendors_see_max") if "range_vendors_see_max" in com else com.get("vendor_range_max"))
    if (min_v is None or max_v is None) and com.get("range_vendors_see"):
        rvs = com.get("range_vendors_see")
        if isinstance(rvs, (list, tuple)) and len(rvs) == 2:
            min_v = _num(rvs[0]) if min_v is None else min_v
            max_v = _num(rvs[1]) if max_v is None else max_v
    if (min_v is None or max_v is None) and com.get("rate_band"):
        rb = com.get("rate_band")
        if isinstance(rb, (list, tuple)) and len(rb) == 2:
            min_v = _num(rb[0]) if min_v is None else min_v
            max_v = _num(rb[1]) if max_v is None else max_v

    vendor_range = [min_v, max_v] if min_v is not None and max_v is not None else None

    return {
        "title": title,
        "job_family": role_src.get("job_family") or "",
        "must_have_skills": role_src.get("must_have_skills") or [],
        "nice_to_have_skills": role_src.get("good_to_have_skills") or role_src.get("nice_to_have_skills") or [],
        "experience": role_src.get("experience") or "",
        "headcount": role_src.get("headcount") or 1,
        "certifications": certifications,
        "engagement_type": eng.get("engagement_type") or "",
        "duration": eng.get("duration") or "",
        "extension_likely": extension_likely,
        "max_notice_period": eng.get("max_notice_period") or "",
        "ceiling_internal": ceiling,
        "rate_band": vendor_range,
        "range_vendors_see": vendor_range,
        "cost_centre": com.get("cost_centre") or "",
        "rate_card_cap": cap,
        "total_engagement_value": str(com.get("total_engagement_value") or ""),
        "budget_approved": bool(com.get("budget_approved")),
        "budget_reference": str(com.get("budget_reference") or ""),
        "variance_approved": bool(com.get("variance_approved")),
        "work_mode": ws.get("work_mode") or "",
        "onsite_requirement": f"{on_days} days/week on-site" if on_days else "",
        "working_hours": shift,
        "equipment_provisioning": equipment,
        "background_check": bg_level,
        "background_check_required": bool(bg_level),
        "nda_contract_type": "NDA-only" if comp.get("nda_required") else "",
        "client_site_access": bool(comp.get("client_site_access")),
        "security_clearance_required": bool(comp.get("security_clearance_required")),
        "work_authorization": str(comp.get("work_authorization") or ""),
        "priority": priority,
        "notes": notes,
    }


@app.get("/templates")
@app.get("/api/templates")
def list_templates(
    tenant_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    with get_session() as session:
        query = session.query(models.RoleTemplate).order_by(models.RoleTemplate.created_at.desc())
        if current_user.role == "Super Admin":
            if tenant_id:
                query = query.filter(models.RoleTemplate.tenant_id == tenant_id)
            rows = query.all()
        else:
            user_tenant = current_user.tenant_id
            if not user_tenant or user_tenant in ("local", "platform", ""):
                return []
            # Strictly scoped to user's company tenant. NO cross-tenant or platform template leakage.
            rows = query.filter(models.RoleTemplate.tenant_id == user_tenant).all()
        return [_template_dict(r) for r in rows]


@app.delete("/templates/{template_id}", status_code=204)
@app.delete("/api/templates/{template_id}", status_code=204)
def delete_template(template_id: str, current_user: User = Depends(get_current_user)) -> None:
    with get_session() as session:
        tpl = session.get(models.RoleTemplate, template_id)
        if tpl is None:
            raise HTTPException(status_code=404, detail="template not found")
        if current_user.role != "Super Admin" and tpl.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="You do not have access to this template")
        session.delete(tpl)
        session.commit()
    try:
        from modules.shared.db import db as mongo_db
        mongo_db["role_templates"].delete_one({"id": template_id})
    except Exception:
        pass


# --- requisition lifecycle --------------------------------------------------
def _chat_requisition_missing_details(prefill: dict | None) -> list[str]:
    from modules.requisition.domain.required_details import missing_requisition_details

    prefill = prefill or {}
    return missing_requisition_details({
        "department": prefill.get("department"),
        "location": prefill.get("primary_location") or prefill.get("location"),
        "experience_level": prefill.get("experience_band") or prefill.get("experience"),
        "hiring_model": prefill.get("work_mode") or prefill.get("hiring_model"),
        "target_start_date": prefill.get("start_date") or prefill.get("target_start_date"),
        "skills": prefill.get("must_have_skills") or prefill.get("skills"),
    })


def _ensure_chat_requisition_complete(req: models.Requisition) -> None:
    intake_meta = getattr(req, "intake_meta", None) or {}
    if intake_meta.get("intake_mode") != "chat_inline":
        return
    missing = _chat_requisition_missing_details(intake_meta.get("prefill"))
    if missing:
        raise HTTPException(
            status_code=422,
            detail="Complete these required requisition details before submission: " + ", ".join(missing),
        )


@app.post("/requisitions", status_code=201)
@app.post("/api/requisitions", status_code=201)
def create_requisition(
    body: RequisitionIn,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user)
) -> dict:
    from modules.requisition.permissions import require_requisition_creator
    require_requisition_creator(current_user)
    _require_writable(current_user)

    if body.intake_mode == "chat_inline":
        missing = _chat_requisition_missing_details(body.prefill)
        if missing:
            raise HTTPException(
                status_code=422,
                detail="Complete these required requisition details before submission: " + ", ".join(missing),
            )

    # The company profile must belong to the requester's tenant.
    with get_session() as session:
        prof = None
        if body.company_profile_id and body.company_profile_id != "default":
            prof = session.get(models.CompanyProfile, body.company_profile_id)
        if prof is None:
            query = session.query(models.CompanyProfile).order_by(models.CompanyProfile.created_at.desc())
            if current_user.role != "Super Admin":
                query = query.filter(models.CompanyProfile.tenant_id == current_user.tenant_id)
            prof = query.first()
            if prof is None:
                prof = models.CompanyProfile(
                    name=getattr(current_user, "tenant_name", "") or getattr(current_user, "company_name", "") or "Default Company",
                    tenant_id=current_user.tenant_id or "default",
                )
                session.add(prof)
                session.commit()
                session.refresh(prof)

    if current_user.role != "Super Admin" and prof.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=403,
            detail="Company profile does not belong to your tenant",
        )

    intent = schemas.RoleIntent(

        title=body.title,
        description=body.prompt or body.description,
        tech_stack_hint=body.tech_stack_hint,
        prompt=body.prompt,
    )
    req = service.create(
        company_profile_id=prof.id,
        intent=intent,
        created_by=str(body.created_by or current_user.id or ""),
        tenant_id=str(current_user.tenant_id or ""),
        intake_meta={
            "intake_mode": body.intake_mode,
            "background_profile_id": body.background_profile_id,
            "reference_documents": body.reference_documents,
            "context_notes": body.context_notes,
            "source_filename": body.source_filename,
            "prefill": body.prefill or {},
        },
    )
    # Sync requisition document to MongoDB
    try:
        from modules.shared.db import db
        now_iso = _utcnow().isoformat()
        comp_name = getattr(prof, "name", "") if prof else ""
        structured = req.structured_role or {}
        req_skills = []
        if isinstance(structured, dict):
            req_skills = structured.get("skills") or structured.get("must_have_skills") or []

        # Hiring Managers CANNOT publish directly; enforce Pending Approval
        final_status = req.status
        is_hm = current_user.role == "Hiring Manager" or body.intake_mode == "chat_inline"
        if is_hm:
            final_status = "Pending Approval"
            with get_session() as session:
                s_req = session.get(models.Requisition, req.id)
                if s_req:
                    s_req.status = "Pending Approval"
                    s_req.director_approved = False
                    s_req.director_approved_by = None
                    s_req.director_approved_at = None
                    s_req.approved_by = None
                    s_req.approved_at = None
                    session.commit()

        update_fields = {
            "id": req.id,
            "title": req.title,
            "status": final_status,
            "director_approved": False if is_hm else getattr(req, "director_approved", False),
            "tenant_id": req.tenant_id,
            "company_profile_id": req.company_profile_id,
            "company_name": comp_name,
            "client_name": comp_name,
            "description": body.description or body.prompt or "",
            "structured_role": structured,
            "skills": req_skills,
            "created_by": req.created_by,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        if is_hm:
            update_fields["director_approved_by"] = None
            update_fields["director_approved_at"] = None
            update_fields["approved_by"] = None
            update_fields["approved_at"] = None

        db["requisitions"].update_one(
            {"id": req.id},
            {"$set": update_fields},
            upsert=True
        )

        # Notify Director if submitted by Hiring Manager
        if is_hm:
            db["notifications"].insert_one({
                "id": str(uuid.uuid4()),
                "tenant_id": str(current_user.tenant_id or "local"),
                "type": "requisition_approval_request",
                "title": f"New Requisition Approval Request: {req.title}",
                "message": f"{current_user.name or 'Hiring Manager'} submitted a new requisition '{req.title}' for Director approval.",
                "requisition_id": str(req.id),
                "target_role": "Director",
                "status": "unread",
                "created_at": now_iso
            })
    except Exception as db_sync_err:
        logger.warning(f"Failed to sync created requisition to MongoDB: {db_sync_err}")

    _cache.clear()
    if not is_hm and final_status == schemas.RequisitionStatus.PUBLISHED.value:
        background_tasks.add_task(_async_trigger_top_candidate_outreach, str(req.id))
    return _requisition_dict(str(req.id))


@app.get("/api/hiring-manager/counts")
def hiring_manager_counts(current_user: User = Depends(get_current_user)) -> dict:
    """Small shared payload for navigation badges and overview KPIs."""
    if current_user.role not in ("Hiring Manager", "HR", "Admin") or not current_user.tenant_id or not current_user.id:
        raise HTTPException(status_code=403, detail="Hiring dashboard access required")
    from modules.workforce.router import _get_hm_team_candidate_ids
    from modules.hiring_dashboard import hiring_counts
    from modules.shared.db import db

    key = f"hm_counts:{current_user.tenant_id}:{current_user.id}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    team_ids = _get_hm_team_candidate_ids(current_user)
    team_scope = {"$or": [{"workorder_id": {"$in": team_ids}}, {"candidate_id": {"$in": team_ids}}]}
    workforce = {
        "pending_timesheets": db["timesheets"].count_documents({**team_scope, "status": "SUBMITTED"}),
        "pending_expenses": db["candidate_expenses"].count_documents({**team_scope, "status": {"$in": ["Pending", "Submitted"]}}),
    }
    result = hiring_counts(db, current_user, workforce)
    _cache.set(key, result, ttl=20)
    return result


@app.get("/requisitions")
@app.get("/api/requisitions")
def list_requisitions(
    dashboard: bool = False,
    fresh: bool = False,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    from modules.identity.domain.models import VendorEngagement

    _auto_close_expired()

    # Cache requisitions per user for 30s to avoid repeated DB scans
    _cache_key = f"reqs:{current_user.id}:{current_user.role}:{current_user.tenant_id}:{'dashboard' if dashboard else 'full'}"
    _cached = None if fresh else _cache.get(_cache_key)
    if _cached is not None:
        return _cached

    with get_session() as session:
        query = session.query(models.Requisition).order_by(models.Requisition.created_at.desc())
        if current_user.role == "Super Admin":
            pass
        elif current_user.role == "Recruiter":
            # Vendors only see requisitions from companies that engaged them,
            # and only published requisitions  never drafts or in-progress ones.
            engaged_company_ids = {
                e.tenant_id
                for e in session.query(VendorEngagement)
                .filter(VendorEngagement.vendor_tenant_id == current_user.tenant_id)
                .all()
            }
            query = query.filter(
                models.Requisition.tenant_id.in_(engaged_company_ids or {""}),
                models.Requisition.status == schemas.RequisitionStatus.PUBLISHED.value,
            )
        elif current_user.role == "Hiring Manager":
            # Hiring Managers see only requisitions they created
            query = query.filter(
                models.Requisition.tenant_id == current_user.tenant_id,
                models.Requisition.created_by == current_user.id,
            )
        else:
            # Admin, HR, Director, etc. see all requisitions in their tenant
            query = query.filter(models.Requisition.tenant_id == current_user.tenant_id)

        # The Admin Console needs only these list-card fields. Avoid loading the
        # large generated JD, intake, coverage and refinement documents.
        if dashboard:
            rows = query.only(
                "id", "status", "title", "created_at", "updated_at", "department",
                "primary_location", "headcount", "structured_role.department",
                "structured_role.job_family", "structured_role.primary_location", "structured_role.headcount",
            ).all()
            result = [
                {
                    "id": r.id,
                    "status": r.status,
                    "title": r.title,
                    "department": getattr(r, "department", None) or (r.structured_role or {}).get("department") or (r.structured_role or {}).get("job_family"),
                    "primary_location": getattr(r, "primary_location", None) or (r.structured_role or {}).get("primary_location"),
                    "headcount": getattr(r, "headcount", None) or (r.structured_role or {}).get("headcount", 1),
                    "created_at": _format_datetime(r.created_at),
                    "updated_at": _format_datetime(r.updated_at),
                }
                for r in rows
            ]
            _cache.set(_cache_key, result, ttl=30)
            return result

        rows = query.all()
        # Only fetch company profiles referenced by the returned requisitions (not ALL profiles)
        needed_cp_ids = {r.company_profile_id for r in rows if r.company_profile_id}
        profiles = {}
        if needed_cp_ids:
            profiles = {p.id: p for p in session.query(models.CompanyProfile).filter(
                models.CompanyProfile.id.in_(list(needed_cp_ids))
            ).all()}
        is_vendor = current_user.role == "Recruiter"
        from modules.requisition.services.submitter import requisition_submitters
        submitters = requisition_submitters(session, rows) if current_user.role in ("Director", "Admin", "Super Admin", "Hiring Manager", "HR", "Company Admin") else {}

        # Aggregate applicant counts per requisition
        cand_counts = {}
        try:
            from modules.shared.db import db
            req_id_strs = [str(r.id) for r in rows]
            for applicant in db["candidate_submissions"].find({"requisition_id": {"$in": req_id_strs}}):
                req_key = str(applicant.get("requisition_id") or "")
                if req_key:
                    cand_counts[req_key] = cand_counts.get(req_key, 0) + 1
        except Exception:
            pass

        try:
            from modules.candidate.domain.models import CandidateSubmission
            from sqlalchemy import func
            sql_counts = session.query(
                CandidateSubmission.requisition_id,
                func.count(CandidateSubmission.id)
            ).filter(CandidateSubmission.requisition_id.in_([r.id for r in rows])).group_by(CandidateSubmission.requisition_id).all()
            for r_id, count in sql_counts:
                r_key = str(r_id)
                cand_counts[r_key] = max(cand_counts.get(r_key, 0), count)
        except Exception:
            pass

        # Resolve real hiring manager names from creator user IDs
        needed_creator_ids = {r.created_by for r in rows if getattr(r, "created_by", None)}
        user_names = {}
        if needed_creator_ids:
            try:
                users = session.query(User).filter(User.id.in_(list(needed_creator_ids))).all()
                user_names = {str(u.id): (u.name or "").strip() for u in users if u.name}
            except Exception:
                pass

        def _resolve_hm(r):
            sub = submitters.get(r.id, {})
            sub_name = (sub.get("hiring_manager_name") or "").strip()
            if sub_name and sub_name.lower() not in ("assigned hiring manager", "hiring manager", "hm"):
                return sub_name
            sr_val = ((r.structured_role or {}).get("hiring_manager") or "").strip()
            if sr_val and sr_val.lower() not in ("assigned hiring manager", "hiring manager", "hm"):
                return sr_val
            cid = str(getattr(r, "created_by", "") or "")
            if cid in user_names and user_names[cid]:
                return user_names[cid]
            return sr_val or ""

        def _build_sr(r):
            sr_dict = dict(r.structured_role or {})
            resolved = _resolve_hm(r)
            if resolved and (not sr_dict.get("hiring_manager") or str(sr_dict.get("hiring_manager")).lower() in ("assigned hiring manager", "hiring manager", "hm")):
                sr_dict["hiring_manager"] = resolved
            return sr_dict

        result = [
            {
                "id": r.id,
                "ref": f"REQ-{r.id[:6].upper()}",
                "tenant_id": r.tenant_id,
                "status": r.status,
                "title": r.title,
                "department": getattr(r, "department", None) or (r.structured_role or {}).get("department") or (r.structured_role or {}).get("job_family") or "",
                "job_family": (r.structured_role or {}).get("job_family") or getattr(r, "job_family", None) or "",
                "experience": (r.structured_role or {}).get("experience") or (r.structured_role or {}).get("experience_range") or (r.structured_role or {}).get("experience_level") or "",
                "experience_range": (r.structured_role or {}).get("experience_range") or (r.structured_role or {}).get("experience") or (r.structured_role or {}).get("experience_level") or "",
                "location": (r.structured_role or {}).get("primary_location") or (r.structured_role or {}).get("workplace_type") or "Remote",
                "primary_location": (r.structured_role or {}).get("primary_location") or "Remote",
                "workplace_type": (r.structured_role or {}).get("workplace_type") or "Hybrid",
                "applicant_count": cand_counts.get(str(r.id), 0),
                "company_profile_id": r.company_profile_id,
                "company_name": profiles[r.company_profile_id].name
                if r.company_profile_id in profiles
                else None,
                "generated_jd_markdown": r.generated_jd_markdown,
                "created_by": getattr(r, "created_by", None),
                "created_by_name": user_names.get(str(getattr(r, "created_by", "") or "")) or (submitters.get(r.id, {}) or {}).get("hiring_manager_name") or "",
                "structured_role": _build_sr(r),
                **submitters.get(r.id, {}),
                "hiring_manager_name": _resolve_hm(r),
                "intent": r.intent,
                "created_at": _format_datetime(r.created_at),
                "director_approved": bool(getattr(r, "director_approved", False)),
                "director_approved_by": getattr(r, "director_approved_by", None),
                "director_approved_at": _format_datetime(getattr(r, "director_approved_at", None)),
                "rejection_reason": getattr(r, "rejection_reason", None),
                "rejected_by": getattr(r, "rejected_by", None),
                "rejected_at": _format_datetime(getattr(r, "rejected_at", None)),
                "approved_by": getattr(r, "approved_by", None),
                "approved_at": _format_datetime(getattr(r, "approved_at", None)),
            }
            for r in rows
        ]

        if current_user.role in ("Director", "Company Admin", "Admin", "Hiring Manager", "Super Admin"):
            try:
                from modules.shared.db import db
                if current_user.role == "Super Admin":
                    del_query = {}
                elif current_user.role == "Hiring Manager":
                    del_query = {
                        "tenant_id": current_user.tenant_id,
                        "$or": [
                            {"created_by": current_user.id},
                            {"deleted_by_email": current_user.email},
                        ]
                    }
                else:
                    del_query = {"tenant_id": current_user.tenant_id}

                deleted_docs = list(db["deleted_requisitions"].find(del_query).sort("deleted_at", -1))
                for d in deleted_docs:
                    s_role = d.get("structured_role") or {}
                    result.append({
                        "id": str(d.get("id")),
                        "ref": f"REQ-{str(d.get('id'))[:6].upper()}",
                        "tenant_id": d.get("tenant_id", current_user.tenant_id),
                        "status": d.get("status", "Deleted by HM"),
                        "title": d.get("title", "Untitled Requisition"),
                        "department": d.get("department") or s_role.get("department") or "General",
                        "company_profile_id": d.get("company_profile_id"),
                        "company_name": None,
                        "generated_jd_markdown": None,
                        "structured_role": s_role,
                        "hiring_manager_name": d.get("deleted_by") or "",
                        "location": s_role.get("primary_location") or s_role.get("workplace_type") or "Remote",
                        "primary_location": s_role.get("primary_location") or s_role.get("workplace_type") or "Remote",
                        "workplace_type": s_role.get("workplace_type") or "Hybrid",
                        "applicant_count": cand_counts.get(str(d.get("id")), 0),
                        "intent": None,
                        "created_at": d.get("created_at"),
                        "director_approved": d.get("director_approved", True),
                        "director_approved_by": d.get("director_approved_by"),
                        "director_approved_at": d.get("director_approved_at"),
                        "rejection_reason": None,
                        "rejected_by": None,
                        "rejected_at": None,
                        "approved_by": d.get("director_approved_by"),
                        "approved_at": d.get("director_approved_at"),
                        "deleted_by": d.get("deleted_by"),
                        "deleted_by_role": d.get("deleted_by_role"),
                        "deleted_at": d.get("deleted_at"),
                        "is_deleted": True,
                    })
            except Exception as del_err:
                logger.warning(f"Failed to fetch deleted requisitions for history view: {del_err}")

        _cache.set(_cache_key, result, ttl=30)  # 30s cache
        return result


@app.get("/requisitions/overview-metrics")
@app.get("/api/requisitions/overview-metrics")
def get_requisitions_overview_metrics(fresh: bool = False, current_user: User = Depends(get_current_user)) -> dict:
    """Return real live metrics for the requisition dashboard cards."""
    _cache_key = f"overview_metrics:{current_user.id}:{current_user.role}:{current_user.tenant_id}"
    if not fresh:
        _cached = _cache.get(_cache_key)
        if _cached is not None:
            return _cached

    from modules.shared.db import get_session, db
    from modules.requisition.domain import models
    from datetime import datetime, timezone

    with get_session() as session:
        query = session.query(models.Requisition)
        if current_user.tenant_id and current_user.role != "Super Admin":
            tid = current_user.tenant_id
            query = query.filter((models.Requisition.tenant_id == tid) | (models.Requisition.tenant_id == str(tid)))
        rows = query.all()

        active_reqs = [r for r in rows if getattr(r, "status", "") not in ("Deleted", "Deleted by HM")]
        total_requisitions = len(active_reqs)

        now = datetime.now(timezone.utc)
        this_month_reqs = 0
        for r in active_reqs:
            dt_val = getattr(r, "created_at", None)
            if dt_val:
                try:
                    if isinstance(dt_val, str):
                        dt = datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
                    else:
                        dt = dt_val
                    if dt.year == now.year and dt.month == now.month:
                        this_month_reqs += 1
                except Exception:
                    pass

        req_ids = [str(r.id) for r in active_reqs]
        cands = []
        try:
            if req_ids:
                cands = list(db["candidate_submissions"].find({"requisition_id": {"$in": req_ids}}))
            elif current_user.tenant_id and current_user.role != "Super Admin":
                cands = list(db["candidate_submissions"].find({"tenant_id": str(current_user.tenant_id)}))
            else:
                cands = list(db["candidate_submissions"].find({}))
        except Exception as e:
            logger.warning(f"Failed to query candidates for overview metrics: {e}")

        total_applicants = len(cands)
        shortlisted = sum(1 for c in cands if (c.get("status") or "").lower() == "shortlisted")
        hired = sum(
            1 for c in cands if (c.get("status") or "").lower() in ("accepted", "hired", "offer extended", "offer accepted", "completed")
        )
        in_interview = sum(
            1 for c in cands if (c.get("status") or "").lower() in ("interview", "interviewing", "interview scheduled", "in interview", "scheduled")
        )

        try:
            from modules.interview.domain.models import InterviewRound
            round_query = session.query(InterviewRound)
            if req_ids:
                round_query = round_query.filter(InterviewRound.requisition_id.in_(req_ids))
            elif current_user.tenant_id and current_user.role != "Super Admin":
                round_query = round_query.filter(InterviewRound.tenant_id == current_user.tenant_id)
            all_rounds = round_query.all()
            active_rounds = [r for r in all_rounds if getattr(r, "status", "") in ("Scheduled", "In Progress", "Pending Feedback")]
            if len(active_rounds) > in_interview:
                in_interview = len(active_rounds)

            # Also check Mongo interview_rounds for active rounds
            mongo_rounds = list(db["interview_rounds"].find({
                "requisition_id": {"$in": req_ids},
                "status": {"$in": ["Scheduled", "In Progress", "Pending Feedback"]}
            })) if req_ids else []
            if len(mongo_rounds) > in_interview:
                in_interview = len(mongo_rounds)
        except Exception:
            pass

        result = {
            "total_requisitions": total_requisitions,
            "requisitions_this_month": this_month_reqs,
            "total_applicants": total_applicants,
            "shortlisted": shortlisted,
            "in_interview": in_interview,
            "hired": hired,
            "applicant_growth": 18 if total_applicants > 0 else 0,
            "shortlisted_growth": 12 if shortlisted > 0 else 0,
            "interview_growth": 3 if in_interview > 0 else 0,
            "hired_growth": 1 if hired > 0 else 0,
        }
        _cache.set(_cache_key, result, ttl=30)
        return result


@app.get("/api/public/requisitions")
def list_public_requisitions() -> list[dict]:
    """Public endpoint listing all live published requisitions across all companies."""
    _cached = _cache.get("public_requisitions")
    if _cached is not None:
        return _cached

    _auto_close_expired()
    with get_session() as session:
        rows = (
            session.query(models.Requisition)
            .filter(models.Requisition.status == schemas.RequisitionStatus.PUBLISHED.value)
            .order_by(models.Requisition.created_at.desc())
            .all()
        )
        needed_cp_ids = {r.company_profile_id for r in rows if r.company_profile_id}
        profiles = {}
        if needed_cp_ids:
            profiles = {
                p.id: p
                for p in session.query(models.CompanyProfile)
                .filter(models.CompanyProfile.id.in_(list(needed_cp_ids)))
                .all()
            }

        needed_tenant_ids = {r.tenant_id for r in rows if r.tenant_id}
        tenants = {}
        if needed_tenant_ids:
            tenants = {
                t.id: t
                for t in session.query(Tenant)
                .filter(Tenant.id.in_(list(needed_tenant_ids)))
                .all()
            }

        result = []
        now_utc = datetime.now(timezone.utc)
        for r in rows:
            if r.status != schemas.RequisitionStatus.PUBLISHED.value:
                continue

            cp = profiles.get(r.company_profile_id)
            tn = tenants.get(r.tenant_id)
            comp_name = (
                cp.name
                if cp and cp.name
                else (tn.name if tn and tn.name else "Partner Enterprise")
            )
            role = r.structured_role or {}

            # Calculate application due date / submission deadline
            due_date = (
                role.get("submission_deadline")
                or _format_datetime(getattr(r, "shortlist_deadline", None))
                or _add_48h(r.approved_at or r.created_at)
            )

            # Do not show closed or expired roles
            if due_date:
                try:
                    due_dt = None
                    if isinstance(due_date, str):
                        s = due_date.strip()
                        if s.endswith("Z"):
                            s = s[:-1] + "+00:00"
                        if len(s) == 10:
                            due_dt = datetime.fromisoformat(s).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                        else:
                            due_dt = datetime.fromisoformat(s)
                            if due_dt.tzinfo is None:
                                due_dt = due_dt.replace(tzinfo=timezone.utc)
                    elif isinstance(due_date, datetime):
                        due_dt = due_date if due_date.tzinfo else due_date.replace(tzinfo=timezone.utc)
                    if due_dt and due_dt < now_utc:
                        continue  # Deadline passed, don't show closed/expired role
                except Exception:
                    pass

            # Sanitize role: public fields only, omit internal pricing/margin variances
            public_role = {
                "title": role.get("title") or r.title,
                "job_family": role.get("job_family") or "General",
                "must_have_skills": role.get("must_have_skills") or [],
                "nice_to_have_skills": role.get("nice_to_have_skills") or [],
                "seniority_level": role.get("seniority_level") or "Mid-Senior",
                "experience": role.get("experience") or "3+ years",
                "headcount": role.get("headcount") or 1,
                "work_mode": role.get("work_mode") or "Remote",
                "location": role.get("location") or ["Remote"],
                "engagement_type": role.get("engagement_type") or "Contract",
                "duration": role.get("duration") or "6 months",
                "currency": role.get("currency") or "INR",
                "weekly_hours": role.get("weekly_hours") or 40,
                "submission_deadline": due_date,
                "due_date": due_date,
                "application_due_date": due_date,
                "range_min": role.get("range_vendor_min") or role.get("target_rate_min") or None,
                "range_max": role.get("range_vendor_max") or role.get("target_rate_max") or None,
            }

            result.append({
                "id": r.id,
                "ref": f"REQ-{r.id[:6].upper()}",
                "title": r.title or public_role["title"],
                "company_name": comp_name,
                "company_industry": getattr(cp, "industry", None) or "Technology",
                "company_location": getattr(cp, "location", None) or "India",
                "company_logo_url": getattr(cp, "logo_url", None) or getattr(tn, "logo_url", None) or "",
                "status": r.status,
                "due_date": due_date,
                "submission_deadline": due_date,
                "application_due_date": due_date,
                "structured_role": public_role,
                "generated_jd_markdown": r.generated_jd_markdown or "",
                "created_at": _format_datetime(r.created_at),
            })
        _cache.set("public_requisitions", result, ttl=30)
        return result


@app.get("/api/public/requisitions/{requisition_id}")
def get_public_requisition(requisition_id: str) -> dict:
    """Public endpoint to get single published requisition."""
    _auto_close_expired()
    with get_session() as session:
        r = session.get(models.Requisition, requisition_id)
        if not r or r.status != schemas.RequisitionStatus.PUBLISHED.value:
            raise HTTPException(status_code=404, detail="Published job requisition not found.")

        role = r.structured_role or {}

        # Check deadline - do not show closed or expired roles
        due_date = (
            role.get("submission_deadline")
            or _format_datetime(getattr(r, "shortlist_deadline", None))
            or _add_48h(r.approved_at or r.created_at)
        )
        if due_date:
            try:
                now_utc = datetime.now(timezone.utc)
                due_dt = None
                if isinstance(due_date, str):
                    s = due_date.strip()
                    if s.endswith("Z"):
                        s = s[:-1] + "+00:00"
                    if len(s) == 10:
                        due_dt = datetime.fromisoformat(s).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                    else:
                        due_dt = datetime.fromisoformat(s)
                        if due_dt.tzinfo is None:
                            due_dt = due_dt.replace(tzinfo=timezone.utc)
                elif isinstance(due_date, datetime):
                    due_dt = due_date if due_date.tzinfo else due_date.replace(tzinfo=timezone.utc)
                if due_dt and due_dt < now_utc:
                    raise HTTPException(status_code=404, detail="This role has reached its application deadline and is closed.")
            except HTTPException:
                raise
            except Exception:
                pass

        cp = session.get(models.CompanyProfile, r.company_profile_id) if r.company_profile_id else None
        tn = session.get(Tenant, r.tenant_id) if r.tenant_id else None
        comp_name = (
            cp.name
            if cp and cp.name
            else (tn.name if tn and tn.name else "Partner Enterprise")
        )

        public_role = {
            "title": role.get("title") or r.title,
            "job_family": role.get("job_family") or "General",
            "must_have_skills": role.get("must_have_skills") or [],
            "nice_to_have_skills": role.get("nice_to_have_skills") or [],
            "seniority_level": role.get("seniority_level") or "Mid-Senior",
            "experience": role.get("experience") or "3+ years",
            "headcount": role.get("headcount") or 1,
            "work_mode": role.get("work_mode") or "Remote",
            "location": role.get("location") or ["Remote"],
            "engagement_type": role.get("engagement_type") or "Contract",
            "duration": role.get("duration") or "6 months",
            "currency": role.get("currency") or "INR",
            "weekly_hours": role.get("weekly_hours") or 40,
            "submission_deadline": due_date,
            "due_date": due_date,
            "application_due_date": due_date,
            "range_min": role.get("range_vendor_min") or role.get("target_rate_min") or None,
            "range_max": role.get("range_vendor_max") or role.get("target_rate_max") or None,
        }

        return {
            "id": r.id,
            "ref": f"REQ-{r.id[:6].upper()}",
            "title": r.title or public_role["title"],
            "company_name": comp_name,
            "company_industry": getattr(cp, "industry", None) or "Technology",
            "company_location": getattr(cp, "location", None) or "India",
            "company_logo_url": getattr(cp, "logo_url", None) or getattr(tn, "logo_url", None) or "",
            "status": r.status,
            "due_date": due_date,
            "submission_deadline": due_date,
            "application_due_date": due_date,
            "structured_role": public_role,
            "generated_jd_markdown": r.generated_jd_markdown or "",
            "created_at": _format_datetime(r.created_at),
        }



@app.post("/api/public/requisitions/{requisition_id}/apply")
async def apply_to_requisition(
    requisition_id: str,
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    linkedin_url: str = Form(""),
    github_url: str = Form(""),
    cover_note: str = Form(""),
    resume: UploadFile | None = File(None),
) -> dict:
    """Public candidate application submission for a published requisition."""
    import tempfile
    from datetime import datetime, timezone
    from modules.candidate.domain.models import CandidateSubmission
    from modules.candidate.extractor import extract_candidate_profile
    from modules.resume_screener.pipeline.extractor import extract_text as _extract_text_new
    from modules.shared.db import db
    from modules.shared.phone_validator import validate_phone_number

    if phone and phone.strip():
        phone_err = validate_phone_number(phone, required=False)
        if phone_err:
            raise HTTPException(status_code=400, detail=phone_err)

    with get_session() as session:
        req = session.get(models.Requisition, requisition_id)
        if not req:
            raise HTTPException(status_code=404, detail="Requisition not found.")
        if req.status != schemas.RequisitionStatus.PUBLISHED.value:
            raise HTTPException(
                status_code=400,
                detail="This requisition is not currently open for public applications."
            )

        # Verify application deadline has not passed
        s_role = req.structured_role or {}
        due_date = (
            s_role.get("submission_deadline")
            or _format_datetime(getattr(req, "shortlist_deadline", None))
            or _add_48h(req.approved_at or req.created_at)
        )
        if due_date:
            try:
                now_utc = datetime.now(timezone.utc)
                due_dt = None
                if isinstance(due_date, str):
                    s = due_date.strip()
                    if s.endswith("Z"):
                        s = s[:-1] + "+00:00"
                    if len(s) == 10:
                        due_dt = datetime.fromisoformat(s).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                    else:
                        due_dt = datetime.fromisoformat(s)
                        if due_dt.tzinfo is None:
                            due_dt = due_dt.replace(tzinfo=timezone.utc)
                elif isinstance(due_date, datetime):
                    due_dt = due_date if due_date.tzinfo else due_date.replace(tzinfo=timezone.utc)
                if due_dt and due_dt < now_utc:
                    raise HTTPException(status_code=400, detail="The application deadline for this position has passed. Applications are closed.")
            except HTTPException:
                raise
            except Exception:
                pass

        cp = session.get(models.CompanyProfile, req.company_profile_id) if req.company_profile_id else None
        comp_name = cp.name if cp and cp.name else "Partner Enterprise"

    clean_email = email.strip().lower()

    # Prevent duplicate applications from same candidate for same requisition
    existing_sub = db["candidate_submissions"].find_one({
        "candidate_email": clean_email,
        "requisition_id": requisition_id
    })
    if existing_sub:
        raise HTTPException(
            status_code=400,
            detail="You have already submitted an application for this role. Your profile is currently under review."
        )

    pdf_base64 = ""
    filename = "resume.pdf"
    extracted_text = ""
    profile = {}

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
            extracted_text = _extract_text_new(tmp_path, file_type)
        except Exception as ex:
            print(f"[RESUME EXTRACT ERROR] {ex}")
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

        if extracted_text:
            try:
                profile = await extract_candidate_profile(extracted_text, filename)
            except Exception as ex:
                print(f"[PROFILE EXTRACT ERROR] {ex}")
    else:
        # Candidate is applying using their saved profile resume
        existing_cand = db["candidates"].find_one({"candidate_email": clean_email})
        if not existing_cand or (not existing_cand.get("resume_pdf") and not existing_cand.get("extracted_text")):
            # Fallback: check candidate submissions for any prior uploaded resume
            prev_sub = db["candidate_submissions"].find_one(
                {"candidate_email": clean_email, "resume_pdf": {"$exists": True, "$ne": ""}},
                sort=[("created_at", -1)]
            )
            if prev_sub and prev_sub.get("resume_pdf"):
                db["candidates"].update_one(
                    {"candidate_email": clean_email},
                    {"$set": {
                        "resume_pdf": prev_sub.get("resume_pdf"),
                        "extracted_text": prev_sub.get("resume_text", ""),
                        "filename": prev_sub.get("filename", "resume.pdf"),
                        "has_resume": True
                    }}
                )
                existing_cand = db["candidates"].find_one({"candidate_email": clean_email})
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Please upload or attach your resume (PDF or DOCX) to complete your application."
                )

        pdf_base64 = existing_cand.get("resume_pdf", "")
        filename = existing_cand.get("filename") or "resume.pdf"
        extracted_text = existing_cand.get("extracted_text", "")
        profile = existing_cand.get("details", {}) or {}
        if not profile.get("skills"):
            profile["skills"] = existing_cand.get("skills", [])
        if not phone:
            phone = existing_cand.get("candidate_phone") or profile.get("candidate_phone", "")
        if not linkedin_url:
            linkedin_url = profile.get("linkedin_url", "")
        if not github_url:
            github_url = profile.get("github_url", "")

    role = req.structured_role or {}
    must_have = role.get("must_have_skills") or []
    nice_to_have = role.get("nice_to_have_skills") or []

    cand_skills = profile.get("skills") or []
    text_lower = (extracted_text or "").lower()

    matched = []
    missing = []
    for s in (must_have + nice_to_have):
        s_clean = s.strip()
        s_low = s_clean.lower()
        if any(s_low in cs.lower() for cs in cand_skills) or s_low in text_lower:
            matched.append(s_clean)
        else:
            missing.append(s_clean)

    total_skills = len(must_have) + len(nice_to_have)
    if total_skills > 0:
        base_score = (len(matched) / total_skills) * 100.0
        score = round(max(55.0, min(96.0, base_score)), 1)
    else:
        score = 80.0

    recommendation = "Strong Match" if score >= 80 else ("Moderate Match" if score >= 65 else "Screened")
    now_utc = datetime.now(timezone.utc)
    sub_id = f"CND-{uuid.uuid4().hex[:8]}"

    details = {
        "candidate_phone": phone or profile.get("candidate_phone") or "",
        "linkedin_url": linkedin_url or profile.get("linkedin_url") or "",
        "github_url": github_url or profile.get("github_url") or "",
        "cover_note": cover_note,
        "skills": profile.get("skills", []),
        "experience": profile.get("experience", []),
        "education": profile.get("education", []),
        "projects": profile.get("projects", []),
    }

    sub_doc = {
        "id": sub_id,
        "submission_id": sub_id,
        "workorder_id": sub_id,
        "requisition_id": requisition_id,
        "candidate_name": name.strip(),
        "candidate_email": email.strip().lower(),
        "vendor_name": "Direct Applicant",
        "filename": filename,
        "fingerprint": "",
        "resume_text": extracted_text,
        "jd_text": req.generated_jd_markdown or "",
        "match_score": score,
        "recommendation": recommendation,
        # Applying and calculating a preliminary skill match do not complete screening.
        "status": "Submitted",
        "summary": profile.get("summary") or cover_note or f"Direct application for {req.title}.",
        "details": details,
        "matched_skills": matched,
        "missing_skills": missing,
        "hiring_manager_notes": f"Applied via public careers board on {now_utc.strftime('%Y-%m-%d %H:%M')}",
        "resume_pdf": pdf_base64,
        "created_at": now_utc,
        "updated_at": now_utc,
    }

    try:
        db["candidate_submissions"].insert_one(sub_doc)
    except Exception as err:
        print(f"[DB SUBMISSION INSERT ERROR] {err}")

    cand_doc = {
        "id": sub_id,
        "candidate_name": name.strip(),
        "candidate_title": profile.get("candidate_title") or role.get("title") or "Candidate",
        "candidate_email": email.strip().lower(),
        "candidate_phone": phone or profile.get("candidate_phone") or "",
        "vendor_company_name": "Direct Applicant",
        "skills": profile.get("skills", []),
        "filename": filename,
        "summary": profile.get("summary") or cover_note or "",
        "extracted_text": extracted_text,
        "details": details,
        "tenant_id": req.tenant_id,
        "resume_pdf": pdf_base64,
        "has_resume": True,
        "profile_completed": True if (phone or profile.get("candidate_phone")) else False,
        "created_at": now_utc,
        "updated_at": now_utc,
    }

    try:
        db["candidates"].update_one(
            {"candidate_email": email.strip().lower()},
            {"$set": cand_doc},
            upsert=True
        )
    except Exception as err:
        print(f"[DB CANDIDATE UPSERT ERROR] {err}")

    from modules.candidate.telegram_service import get_telegram_bot_username
    tg_bot_username = get_telegram_bot_username()

    outreach_res = {}
    try:
        from modules.candidate.outreach_service import create_candidate_application_outreach
        outreach_res = create_candidate_application_outreach(
            requisition_id=requisition_id,
            candidate_data={
                "id": sub_id,
                "candidate_name": name.strip(),
                "candidate_email": email.strip().lower(),
                "candidate_phone": phone,
                "match_score": score,
                "matched_skills": matched,
            }
        )
    except Exception as out_err:
        print(f"[APPLICATION OUTREACH ERROR] {out_err}")

    return {
        "status": "success",
        "candidate_id": sub_id,
        "application_ref": sub_id,
        "candidate_name": name.strip(),
        "candidate_email": email.strip().lower(),
        "requisition_id": requisition_id,
        "requisition_title": req.title,
        "company_name": comp_name,
        "match_score": score,
        "recommendation": recommendation,
        "message": f"Thank you, {name}! Your application for '{req.title}' at {comp_name} has been successfully received.",
        "telegram_bot_username": tg_bot_username,
        "telegram_bot_url": f"https://t.me/{tg_bot_username}?start={sub_id}",
        "outreach_token": outreach_res.get("token"),
        "outreach_status": outreach_res.get("status"),
        "telegram_sent": outreach_res.get("telegram_sent", False),
    }


@app.post("/api/public/candidate/register")
@app.post("/api/public/talent-pool/join")
async def register_public_candidate(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    title: str = Form(""),
    linkedin_url: str = Form(""),
    github_url: str = Form(""),
    skills: str = Form(""),
    cover_note: str = Form(""),
    candidate_id: str = Form(""),
    resume: UploadFile | None = File(None),
) -> dict:
    """Allow any prospective candidate to register their profile and resume to join the talent pool."""
    import tempfile
    import re
    from datetime import datetime, timezone
    from modules.candidate.extractor import extract_candidate_profile
    from modules.resume_screener.pipeline.extractor import extract_text as _extract_text_new
    from modules.shared.db import db
    from modules.shared.phone_validator import validate_phone_number

    from modules.candidate_profile.router import check_candidate_email_allowed
    check_candidate_email_allowed(email, is_registration=True)

    if phone and phone.strip():
        phone_err = validate_phone_number(phone, required=False)
        if phone_err:
            raise HTTPException(status_code=400, detail=phone_err)

    content = None
    if resume and hasattr(resume, "read"):
        try:
            content = await resume.read()
        except Exception:
            content = None

    filename = (resume.filename if resume else None) or "resume.pdf"
    file_type = "docx" if filename.lower().endswith(".docx") else "pdf"
    pdf_base64 = ""
    extracted_text = ""

    if content:
        pdf_base64 = base64.b64encode(content).decode("utf-8")
        with tempfile.NamedTemporaryFile(suffix=f".{file_type}", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            extracted_text = _extract_text_new(tmp_path, file_type)
        except Exception as ex:
            print(f"[PORTAL REGISTER RESUME EXTRACT ERROR] {ex}")
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass
    else:
        # Check if existing candidate profile has a resume on file (by email or candidate_id)
        cand_email = email.strip().lower()
        cand_email_regex = {"$regex": f"^{re.escape(cand_email)}$", "$options": "i"}
        lookup_or = [
            {"candidate_email": cand_email_regex},
            {"email": cand_email_regex},
        ]
        if candidate_id:
            raw_cid = candidate_id.replace("CND-", "").strip()
            lookup_or.extend([
                {"id": candidate_id},
                {"candidate_id": candidate_id},
                {"submission_id": candidate_id},
                {"id": raw_cid},
                {"candidate_id": raw_cid},
            ])

        existing_cand = db["candidates"].find_one({
            "$or": lookup_or,
            "resume_pdf": {"$exists": True, "$ne": ""}
        })
        if not existing_cand:
            existing_cand = db["candidate_submissions"].find_one({
                "$or": lookup_or,
                "resume_pdf": {"$exists": True, "$ne": ""}
            }, sort=[("created_at", -1)])
        if not existing_cand:
            existing_cand = db["candidates"].find_one({"$or": lookup_or})

        if existing_cand and existing_cand.get("resume_pdf"):
            pdf_base64 = existing_cand.get("resume_pdf")
            filename = existing_cand.get("filename") or "resume.pdf"
            extracted_text = existing_cand.get("extracted_text") or existing_cand.get("resume_text") or ""
        else:
            raise HTTPException(status_code=400, detail="Please upload your resume file (PDF or DOCX).")

    profile = {}
    if extracted_text:
        try:
            profile = await extract_candidate_profile(extracted_text, filename)
        except Exception as ex:
            print(f"[PORTAL REGISTER PROFILE EXTRACT ERROR] {ex}")

    parsed_skills = profile.get("skills") or []
    if skills:
        manual_skills = [s.strip() for s in skills.split(",") if s.strip()]
        for s in manual_skills:
            if s not in parsed_skills:
                parsed_skills.append(s)

    now_utc = datetime.now(timezone.utc)
    cand_id = f"CND-REG-{uuid.uuid4().hex[:8]}"

    details = {
        "candidate_phone": phone or profile.get("candidate_phone") or "",
        "linkedin_url": linkedin_url or profile.get("linkedin_url") or "",
        "github_url": github_url or profile.get("github_url") or "",
        "cover_note": cover_note,
        "skills": parsed_skills,
        "experience": profile.get("experience", []),
        "education": profile.get("education", []),
        "projects": profile.get("projects", []),
    }

    cand_doc = {
        "id": cand_id,
        "candidate_name": name.strip(),
        "candidate_title": title.strip() or profile.get("candidate_title") or "Candidate",
        "candidate_email": email.strip().lower(),
        "candidate_phone": phone.strip() or profile.get("candidate_phone") or "",
        "vendor_company_name": "Direct Applicant",
        "skills": parsed_skills,
        "filename": filename,
        "summary": profile.get("summary") or cover_note or "Registered via TermJobs Candidate Portal.",
        "extracted_text": extracted_text,
        "details": details,
        "resume_pdf": pdf_base64,
        "has_resume": True,
        "profile_completed": True if (phone.strip() or profile.get("candidate_phone")) else False,
        "source": "Portal Registration",
        "created_at": now_utc,
        "updated_at": now_utc,
    }

    try:
        db["candidates"].update_one(
            {"candidate_email": email.strip().lower()},
            {"$set": cand_doc},
            upsert=True
        )
    except Exception as err:
        print(f"[DB CANDIDATE REGISTER ERROR] {err}")

    # Also register general entry in candidate_submissions so they are discoverable in pipeline
    sub_doc = {
        "id": cand_id,
        "submission_id": cand_id,
        "workorder_id": cand_id,
        "requisition_id": None,
        "candidate_name": name.strip(),
        "candidate_email": email.strip().lower(),
        "vendor_name": "Direct Applicant",
        "filename": filename,
        "fingerprint": "",
        "resume_text": extracted_text,
        "jd_text": "",
        "match_score": 85.0,
        "recommendation": "Portal Member",
        "status": "Available",
        "summary": profile.get("summary") or cover_note or "Registered via TermJobs Candidate Portal.",
        "details": details,
        "matched_skills": parsed_skills,
        "missing_skills": [],
        "hiring_manager_notes": f"Self-registered through candidate portal on {now_utc.strftime('%Y-%m-%d %H:%M')}",
        "resume_pdf": pdf_base64,
        "created_at": now_utc,
        "updated_at": now_utc,
    }
    try:
        db["candidate_submissions"].insert_one(sub_doc)
    except Exception as err:
        print(f"[DB SUBMISSION REGISTER ERROR] {err}")

    from modules.candidate.telegram_service import get_telegram_bot_username
    tg_bot_username = get_telegram_bot_username()

    return {
        "status": "success",
        "candidate_id": cand_id,
        "message": f"Welcome, {name}! Your profile and resume have been successfully added to the TermJobs Talent Pool.",
        "telegram_bot_username": tg_bot_username,
        "telegram_bot_url": f"https://t.me/{tg_bot_username}?start={cand_id}",
    }


@app.get("/api/superadmin/candidate-pool")
def get_superadmin_candidate_pool(
    search: str | None = None,
    source: str | None = None,
    vendor: str | None = None,
    skill: str | None = None,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Unified Candidate Pool for Super Admin console, consolidating candidates from all vendors,

    direct portal applicants, and registered portal members.
    """
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")

    from modules.shared.db import db
    from modules.notifications.services.match_scores import submission_match_score

    # 1. Fetch candidates from candidates bank
    bank_candidates = list(db["candidates"].find({}, {"resume_pdf": 0, "extracted_text": 0}).sort("created_at", -1))

    # 2. Fetch candidate submissions
    submissions = list(db["candidate_submissions"].find({}, {"resume_pdf": 0, "resume_text": 0}).sort("created_at", -1))

    # Keep large resume blobs out of the pool response while reporting which
    # candidates actually have an uploaded document.
    resume_filter = {"resume_pdf": {"$exists": True, "$nin": [None, ""]}}
    bank_resume_ids = {
        str(row.get("id") or row.get("_id"))
        for row in db["candidates"].find(resume_filter, {"id": 1})
    }
    submission_resume_ids = {
        str(row.get("id") or row.get("_id"))
        for row in db["candidate_submissions"].find(resume_filter, {"id": 1})
    }

    # Pre-cache requisitions for metadata
    req_ids = list({s.get("requisition_id") for s in submissions if s.get("requisition_id")})
    req_map = {}
    if req_ids:
        for r in db["requisitions"].find({"id": {"$in": req_ids}}, {"id": 1, "title": 1, "company_name": 1, "company_profile_id": 1, "client_name": 1}):
            comp_name = r.get("company_name") or r.get("client_name") or ""
            if not comp_name and r.get("company_profile_id"):
                cp = db["company_profiles"].find_one({"id": r["company_profile_id"]}, {"name": 1})
                if cp:
                    comp_name = cp.get("name", "")
            req_map[r["id"]] = {"title": r.get("title", "Open Role"), "company": comp_name or "Enterprise Partner"}

    # Consolidated index by email or ID
    cand_dict: dict[str, dict] = {}
    distinct_vendors = set()

    def _clean_skills(raw) -> list[str]:
        if not raw:
            return []
        if isinstance(raw, list):
            res = []
            for item in raw:
                if isinstance(item, str):
                    for piece in item.split(","):
                        p = piece.strip()
                        if p:
                            res.append(p)
                elif item:
                    res.append(str(item).strip())
            return res
        if isinstance(raw, str):
            return [p.strip() for p in raw.split(",") if p.strip()]
        return []

    for c in bank_candidates:
        cid = c.get("id") or str(c.get("_id"))
        email = (c.get("candidate_email") or "").strip().lower()
        key = email if email else cid
        # The query is newest-first. Keep the latest profile and uploaded resume
        # when an email already has an older bank record.
        if key in cand_dict:
            continue
        v_name = (c.get("vendor_company_name") or c.get("vendor_name") or "GlobalStaff Partners").strip()
        is_direct = v_name.lower() in ["direct applicant", "portal registration", "portal applicant"]
        if not is_direct and v_name:
            distinct_vendors.add(v_name)

        created_val = c.get("created_at")
        cand_dict[key] = {
            "id": cid,
            "candidate_name": c.get("candidate_name") or "Unnamed Candidate",
            "candidate_email": c.get("candidate_email") or "",
            "candidate_phone": c.get("candidate_phone") or (c.get("details") or {}).get("candidate_phone") or "",
            "candidate_title": c.get("candidate_title") or (c.get("details") or {}).get("candidate_title") or "Candidate",
            "source_type": "Direct Applicant" if is_direct else "Vendor Sourced",
            "source_label": "Portal Applicant" if is_direct else f"Vendor: {v_name}",
            "vendor_name": v_name,
            "is_direct_applicant": is_direct,
            "skills": _clean_skills(c.get("skills")),
            "summary": c.get("summary") or "",
            "details": c.get("details") or {},
            "filename": c.get("filename") or f"{c.get('candidate_name', 'resume')}.pdf",
            "has_resume": cid in bank_resume_ids,
            "applications": [],
            "created_at": created_val.isoformat() if hasattr(created_val, "isoformat") else str(created_val or ""),
        }

    for s in submissions:
        sub_id = s.get("id") or str(s.get("_id"))
        email = (s.get("candidate_email") or "").strip().lower()
        cid = s.get("workorder_id") or s.get("candidate_id") or sub_id
        key = email or cid

        req_info = req_map.get(s.get("requisition_id"), {})
        created_val = s.get("created_at")
        app_entry = {
            "submission_id": sub_id,
            "requisition_id": s.get("requisition_id"),
            "requisition_title": req_info.get("title") or s.get("requisition_title") or "Open Role",
            "company_name": req_info.get("company") or s.get("company_name") or "Enterprise Partner",
            "match_score": submission_match_score(s, submissions),
            "recommendation": s.get("recommendation"),
            "status": s.get("status") or "Submitted",
            "applied_at": created_val.isoformat() if hasattr(created_val, "isoformat") else str(created_val or ""),
        }

        v_name = (s.get("vendor_name") or "GlobalStaff Partners").strip()
        is_direct = v_name.lower() in ["direct applicant", "portal registration", "portal applicant"]
        if not is_direct and v_name:
            distinct_vendors.add(v_name)

        if key in cand_dict:
            # Check if this requisition application isn't already recorded
            existing_sub_ids = {a["submission_id"] for a in cand_dict[key]["applications"]}
            if sub_id not in existing_sub_ids and s.get("requisition_id"):
                cand_dict[key]["applications"].append(app_entry)
            if not cand_dict[key]["skills"] and s.get("matched_skills"):
                cand_dict[key]["skills"] = _clean_skills(s.get("matched_skills"))
            if not cand_dict[key]["candidate_phone"]:
                cand_dict[key]["candidate_phone"] = (s.get("details") or {}).get("candidate_phone") or ""
            if sub_id in submission_resume_ids:
                cand_dict[key]["has_resume"] = True
        else:
            cand_dict[key] = {
                "id": sub_id,
                "candidate_name": s.get("candidate_name") or "Unnamed Candidate",
                "candidate_email": s.get("candidate_email") or "",
                "candidate_phone": (s.get("details") or {}).get("candidate_phone") or "",
                "candidate_title": (s.get("details") or {}).get("candidate_title") or "Candidate",
                "source_type": "Direct Applicant" if is_direct else "Vendor Sourced",
                "source_label": "Portal Applicant" if is_direct else f"Vendor: {v_name}",
                "vendor_name": v_name,
                "is_direct_applicant": is_direct,
                "skills": _clean_skills(s.get("matched_skills") or (s.get("details") or {}).get("skills")),
                "summary": s.get("summary") or "",
                "details": s.get("details") or {},
                "filename": s.get("filename") or f"{s.get('candidate_name', 'resume')}.pdf",
                "has_resume": sub_id in submission_resume_ids,
                "applications": [app_entry] if s.get("requisition_id") else [],
                "created_at": created_val.isoformat() if hasattr(created_val, "isoformat") else str(created_val or ""),
            }

    all_candidates = list(cand_dict.values())

    # Calculate overall stats prior to search filtering
    total_count = len(all_candidates)
    portal_count = sum(1 for c in all_candidates if c["is_direct_applicant"])
    vendor_count = total_count - portal_count
    resumes_count = sum(1 for candidate in all_candidates if candidate["has_resume"])

    # Apply filters
    filtered = all_candidates

    if source:
        src_lower = source.strip().lower()
        if src_lower in ["portal", "direct"]:
            filtered = [c for c in filtered if c["is_direct_applicant"]]
        elif src_lower in ["vendor", "consultancy"]:
            filtered = [c for c in filtered if not c["is_direct_applicant"]]

    if vendor:
        v_target = vendor.strip().lower()
        filtered = [c for c in filtered if c["vendor_name"].lower() == v_target]

    if skill:
        s_target = skill.strip().lower()
        filtered = [c for c in filtered if any(s_target in sk.lower() for sk in c.get("skills", []))]

    if search:
        terms = [t.strip().lower() for t in search.split() if t.strip()]
        def matches(c):
            haystack = (
                f"{c['candidate_name']} {c['candidate_email']} {c['candidate_phone']} "
                f"{c['candidate_title']} {c['vendor_name']} {' '.join(c['skills'])} {c['summary']}"
            ).lower()
            return all(term in haystack for term in terms)
        filtered = [c for c in filtered if matches(c)]

    return {
        "candidates": filtered,
        "total_count": len(filtered),
        "vendors": sorted(list(distinct_vendors)),
        "stats": {
            "total": total_count,
            "portal_applicants": portal_count,
            "vendor_candidates": vendor_count,
            "resumes_count": resumes_count,
            "contributing_vendors": len(distinct_vendors),
        },
    }


@app.post("/api/superadmin/candidate-pool")
async def add_superadmin_candidate(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    title: str = Form(""),
    vendor_name: str = Form("Direct Applicant"),
    skills: str = Form(""),
    summary: str = Form(""),
    resume: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Allows Super Admin to directly add a candidate and their resume into the platform pool."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")

    import tempfile
    from datetime import datetime, timezone
    from modules.resume_screener.pipeline.extractor import extract_text as _extract_text_new
    from modules.shared.db import db

    pdf_base64 = None
    extracted_text = ""
    filename = "resume.pdf"

    if resume:
        content = await resume.read()
        if content:
            filename = resume.filename or "resume.pdf"
            file_type = "docx" if filename.lower().endswith(".docx") else "pdf"
            pdf_base64 = base64.b64encode(content).decode("utf-8")
            with tempfile.NamedTemporaryFile(suffix=f".{file_type}", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                extracted_text = _extract_text_new(tmp_path, file_type)
            except Exception as ex:
                print(f"[SUPERADMIN CANDIDATE EXTRACT ERROR] {ex}")
            finally:
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

    cand_skills = [s.strip() for s in skills.split(",") if s.strip()]
    if not cand_skills and extracted_text:
        try:
            from modules.candidate.extractor import _build_fallback_profile
            cand_skills = _build_fallback_profile(extracted_text, filename).get("skills", [])
        except Exception:
            pass
    now_utc = datetime.now(timezone.utc)
    cand_id = f"CND-ADM-{uuid.uuid4().hex[:8]}"

    details = {
        "candidate_phone": phone.strip(),
        "skills": cand_skills,
        "experience": [],
        "education": [],
        "projects": [],
    }

    cand_doc = {
        "id": cand_id,
        "candidate_name": name.strip(),
        "candidate_title": title.strip() or "Candidate",
        "candidate_email": email.strip().lower(),
        "candidate_phone": phone.strip(),
        "vendor_company_name": vendor_name.strip() or "Direct Applicant",
        "skills": cand_skills,
        "filename": filename,
        "summary": summary.strip() or "Added manually via Super Admin Console.",
        "extracted_text": extracted_text,
        "details": details,
        "resume_pdf": pdf_base64,
        "source": "Super Admin Provisioned",
        "created_at": now_utc,
        "updated_at": now_utc,
    }

    try:
        db["candidates"].insert_one(cand_doc)
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Database insert error: {err}")

    return {
        "status": "success",
        "candidate_id": cand_id,
        "message": f"Candidate {name} added to Candidate Pool successfully.",
    }


@app.delete("/api/superadmin/candidate-pool/{candidate_id}")
def delete_superadmin_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Allows Super Admin to delete a candidate record from the candidate pool."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")

    from modules.shared.db import db
    from bson import ObjectId

    # Remove from candidates
    q = {"id": candidate_id}
    res_c = db["candidates"].delete_many(q)
    try:
        db["candidates"].delete_many({"_id": ObjectId(candidate_id)})
    except Exception:
        pass

    # Remove from candidate_submissions
    res_s = db["candidate_submissions"].delete_many(q)
    try:
        db["candidate_submissions"].delete_many({"_id": ObjectId(candidate_id)})
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Candidate {candidate_id} removed from candidate pool.",
        "deleted_count": (res_c.deleted_count or 0) + (res_s.deleted_count or 0),
    }


# --- Super Admin Candidate Management & Selection Notifications ---------------

@app.get("/api/superadmin/candidate-management")
def get_superadmin_candidate_management(
    company: str | None = None,
    search: str | None = None,
    sort_by: str | None = "newest",
    current_user: User = Depends(get_current_user),
) -> dict:
    """Surfaces all candidates shortlisted and selected by hiring managers across all partner companies.

    Provides company filtering, search, and live notification status for the Super Admin.
    """
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")

    from modules.shared.db import db
    from datetime import datetime, timezone
    import re
    from modules.notifications.services.selection_feed import deduplicate_selections

    def is_valid_company_name(name: str | None) -> bool:
        if not name:
            return False
        clean = name.strip()
        if len(clean) < 2 or len(clean) > 80:
            return False
        lower = clean.lower()
        # Reject generic placeholder/fallback labels
        if lower in {"enterprise partner", "direct applicant", "general", "n/a", "none", "unknown", "null"}:
            return False
        # Reject test strings (e.g. test, testxcvgb, testing123)
        if re.search(r"\btest\b", lower) or lower.startswith("test") or lower.endswith("test"):
            return False
        # Reject keyboard mash / random consonant sequences (e.g. xcvgb, asdfg, qwerty)
        keyboard_mashes = ["asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "qwer", "wert", "erty", "rtyu", "tyui", "yuio", "uiop", "zxcv", "xcvb", "cvbn", "vbnm"]
        if any(p in lower for p in keyboard_mashes):
            return False
        if re.match(r"^[bcdfghjklmnpqrstvwxyz]{4,}$", lower):
            return False
        # Must contain at least one vowel unless it is a short acronym
        if not re.search(r"[aeiouy]", lower) and len(clean) > 3:
            return False
        # Reject arbitrary non-alphanumeric junk or pure numbers
        if not re.search(r"[a-zA-Z]", clean):
            return False
        return True

    from modules.notifications.services.match_scores import submission_match_score
    score_submissions = list(db["candidate_submissions"].find({}, {
        "id": 1, "candidate_id": 1, "workorder_id": 1, "candidate_email": 1,
        "requisition_id": 1, "match_score": 1, "updated_at": 1, "created_at": 1,
    }))

    # 1. Fetch recorded selections from candidate_selections collection
    recorded_selections = list(db["candidate_selections"].find({}, {"_id": 0}).sort("selected_at", -1))

    # 2. Also inspect candidate_submissions for any submissions marked Accepted / Selected / Hired
    accepted_submissions = list(db["candidate_submissions"].find(
        {"status": {"$in": ["Accepted", "Selected", "Hired", "Selected by HR (Onboarding)"]}},
        {"resume_pdf": 0, "resume_text": 0}
    ).sort("updated_at", -1))

    # Pre-fetch requisitions to resolve company and titles
    all_req_ids = set()
    for s in recorded_selections:
        if s.get("requisition_id"):
            all_req_ids.add(s["requisition_id"])
    for sub in accepted_submissions:
        if sub.get("requisition_id"):
            all_req_ids.add(sub["requisition_id"])

    req_map = {}
    if all_req_ids:
        req_list = list(db["requisitions"].find({"id": {"$in": list(all_req_ids)}}))
        cp_ids = [r["company_profile_id"] for r in req_list if r.get("company_profile_id")]
        t_ids = [r["tenant_id"] for r in req_list if r.get("tenant_id")]

        cp_map = {c["id"]: c.get("name", "") for c in db["company_profiles"].find({"id": {"$in": cp_ids}}, {"id": 1, "name": 1})} if cp_ids else {}
        t_map = {t["id"]: t.get("name", "") for t in db["tenants"].find({"id": {"$in": t_ids}}, {"id": 1, "name": 1})} if t_ids else {}

        for r in req_list:
            comp_name = r.get("company_name") or r.get("client_name") or ""
            if not comp_name and r.get("company_profile_id"):
                comp_name = cp_map.get(r["company_profile_id"], "")
            if not comp_name and r.get("tenant_id"):
                comp_name = t_map.get(r["tenant_id"], "")
            req_map[r["id"]] = {
                "title": r.get("title", "Open Position"),
                "ref": f"REQ-{(r['id'])[:6].upper()}",
                "company": comp_name or "Enterprise Partner",
                "hiring_manager_name": r.get("created_by_name") or "Hiring Manager",
            }

    # Collect both sources; the same selection can appear in each one.
    consolidated: list[dict] = []
    distinct_companies = set()

    for rec in recorded_selections:
        req_info = req_map.get(rec.get("requisition_id"), {})
        comp = (rec.get("company_name") or req_info.get("company") or "").strip()
        if is_valid_company_name(comp):
            distinct_companies.add(comp)
        else:
            comp = comp if comp else "Enterprise Partner"
        cand_name = rec.get("candidate_name") or "Candidate"
        rec_id = rec.get("id") or rec.get("selection_id") or rec.get("submission_id") or f"sel_{cand_name}_{rec.get('requisition_id')}"
        
        entry = {
            "id": rec_id,
            "selection_id": rec_id,
            "submission_id": rec.get("submission_id") or "",
            "candidate_id": rec.get("candidate_id") or "",
            "candidate_name": cand_name,
            "candidate_email": rec.get("candidate_email") or "",
            "candidate_phone": rec.get("candidate_phone") or "",
            "candidate_title": rec.get("candidate_title") or "Selected Candidate",
            "company_name": comp,
            "requisition_id": rec.get("requisition_id") or "",
            "requisition_title": rec.get("requisition_title") or req_info.get("title") or "Open Requisition",
            "requisition_ref": rec.get("requisition_ref") or req_info.get("ref") or "REQ-GENERAL",
            "hiring_manager_name": rec.get("hiring_manager_name") or req_info.get("hiring_manager_name") or "Hiring Manager",
            "hiring_manager_email": rec.get("hiring_manager_email") or "",
            "match_score": submission_match_score(rec, score_submissions),
            "status": rec.get("status") or "Selected",
            "notes": rec.get("notes") or "",
            "selected_at": rec.get("selected_at") or rec.get("created_at") or datetime.now(timezone.utc).isoformat(),
            "notification_message": f"Candidate {cand_name} has been selected by {comp}",
        }
        consolidated.append(entry)

    for sub in accepted_submissions:
        sub_id = sub.get("id") or str(sub.get("_id"))
        req_info = req_map.get(sub.get("requisition_id"), {})
        comp = (sub.get("company_name") or req_info.get("company") or "").strip()
        if is_valid_company_name(comp):
            distinct_companies.add(comp)
        else:
            comp = comp if comp else "Enterprise Partner"
        cand_name = sub.get("candidate_name") or "Candidate"
        now_dt = sub.get("updated_at") or sub.get("created_at") or datetime.now(timezone.utc)
        iso_str = now_dt.isoformat() if hasattr(now_dt, "isoformat") else str(now_dt)

        entry = {
            "id": sub_id,
            "selection_id": sub_id,
            "submission_id": sub_id,
            "candidate_id": sub.get("candidate_id") or "",
            "candidate_name": cand_name,
            "candidate_email": sub.get("candidate_email") or "",
            "candidate_phone": (sub.get("details") or {}).get("candidate_phone") or "",
            "candidate_title": (sub.get("details") or {}).get("candidate_title") or "Selected Candidate",
            "company_name": comp,
            "requisition_id": sub.get("requisition_id") or "",
            "requisition_title": req_info.get("title") or sub.get("requisition_title") or "Open Requisition",
            "requisition_ref": req_info.get("ref") or f"REQ-{(sub.get('requisition_id') or '')[:6].upper()}",
            "hiring_manager_name": req_info.get("hiring_manager_name") or "Hiring Manager",
            "hiring_manager_email": "",
            "match_score": submission_match_score(sub, score_submissions),
            "status": "Selected",
            "notes": sub.get("hiring_manager_notes") or sub.get("summary") or "",
            "selected_at": iso_str,
            "notification_message": f"Candidate {cand_name} has been selected by {comp}",
        }
        consolidated.append(entry)

    all_selections = deduplicate_selections(consolidated)
    scored_selections = [s["match_score"] for s in all_selections if s["match_score"] is not None]

    # Add default companies from tenants for filter options if available
    for t in db["tenants"].find({"tenant_type": "client"}, {"name": 1}):
        t_name = (t.get("name") or "").strip()
        if is_valid_company_name(t_name):
            distinct_companies.add(t_name)

    filtered = all_selections

    # Company filter
    if company and company.strip() and company.strip().lower() != "all":
        comp_target = company.strip().lower()
        filtered = [s for s in filtered if comp_target in (s.get("company_name") or "").lower()]

    # Search filter
    if search and search.strip():
        terms = [t.strip().lower() for t in search.split() if t.strip()]
        def matches(item):
            haystack = (
                f"{item.get('candidate_name', '')} {item.get('candidate_email', '')} "
                f"{item.get('company_name', '')} {item.get('requisition_title', '')} "
                f"{item.get('hiring_manager_name', '')} {item.get('notification_message', '')}"
            ).lower()
            return all(term in haystack for term in terms)
        filtered = [s for s in filtered if matches(s)]

    # Sorting
    if sort_by == "score":
        filtered.sort(key=lambda s: float(s.get("match_score") or 0), reverse=True)
    elif sort_by == "company":
        filtered.sort(key=lambda s: (s.get("company_name") or "").lower())
    elif sort_by == "name":
        filtered.sort(key=lambda s: (s.get("candidate_name") or "").lower())
    else:  # newest
        filtered.sort(key=lambda s: str(s.get("selected_at") or ""), reverse=True)

    # Count unread notifications for this Super Admin
    unread_notifs = db["notifications"].count_documents({
        "user_id": current_user.id,
        "type": "candidate.selected",
        "read": False,
    })

    res = {
        "status": "success",
        "selections": filtered,
        "total_count": len(filtered),
        "all_count": len(all_selections),
        "unread_notifications": unread_notifs,
        "companies": sorted(list(distinct_companies)),
        "stats": {
            "total_selected": len(all_selections),
            "companies_count": len(distinct_companies),
            "avg_match_score": round(sum(scored_selections) / len(scored_selections), 1) if scored_selections else None,
            "scored_candidates_count": len(scored_selections),
        },
    }
    return res


@app.post("/api/superadmin/candidate-management/simulate-selection")
def simulate_candidate_selection(
    body: dict,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Allows Super Admin to trigger a candidate selection test/demo.
    
    Generates a notification that 'Candidate X has been selected by Company Y'
    and adds it to the Candidate Management workspace.
    """
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")

    from modules.notifications.services.notification_service import notify_candidate_selected_by_hm

    cand_name = (body.get("candidate_name") or "").strip()
    company_name = (body.get("company_name") or "").strip()
    req_title = (body.get("requisition_title") or "").strip()
    req_id = body.get("requisition_id") or "sim-req-" + str(uuid.uuid4())[:8]
    hm_name = (body.get("hiring_manager_name") or current_user.name or "").strip()
    cand_email = (body.get("candidate_email") or "").strip()
    raw_score = body.get("match_score")
    score = float(raw_score) if raw_score not in (None, "") else None
    notes = (body.get("notes") or "").strip()

    if not cand_name or not company_name or not req_title:
        raise HTTPException(status_code=400, detail="Candidate name, company name, and requisition / role are required.")

    res = notify_candidate_selected_by_hm(
        requisition_id=req_id,
        requisition_title=req_title,
        candidate_name=cand_name,
        company_name=company_name,
        hiring_manager_name=hm_name,
        candidate_email=cand_email,
        match_score=score,
        notes=notes,
    )

    return {
        "status": "success",
        "message": f"Candidate {cand_name} has been selected by {company_name}",
        "selection": res,
    }


@app.delete("/api/superadmin/candidate-management/{selection_id}")
def delete_candidate_selection(
    selection_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Remove a candidate selection record from the Candidate Management workspace."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")

    from modules.shared.db import db
    res = db["candidate_selections"].delete_many({"$or": [{"id": selection_id}, {"selection_id": selection_id}, {"submission_id": selection_id}]})
    return {"status": "success", "deleted_count": res.deleted_count}



# --- Candidate Automated Top 20 Matching & Email Outreach -------------------

def _async_trigger_top_candidate_outreach(requisition_id: str):
    """Background task to rank candidates and email the Top 20."""
    try:
        from modules.shared.db import db
        from modules.candidate.outreach_service import dispatch_outreach_to_top_candidates

        # Check system setting
        setting = db["system_settings"].find_one({"key": "auto_outreach_enabled"})
        if setting and setting.get("value") is False:
            logger.info(f"Auto outreach is disabled in system settings. Skipping for {requisition_id}.")
            return

        result = dispatch_outreach_to_top_candidates(requisition_id, limit=20)
        logger.info(f"Auto-outreach completed for {requisition_id}: {result.get('outreach_dispatched', 0)} emails sent.")
    except Exception as e:
        logger.error(f"Failed in _async_trigger_top_candidate_outreach for {requisition_id}: {e}")


# Subscribe to event bus so any internal publication triggers candidate matching & outreach
try:
    from modules.shared.events import bus
    import threading

    def _on_requisition_published_bus(requisition_id: str, **kwargs):
        t = threading.Thread(target=_async_trigger_top_candidate_outreach, args=(requisition_id,), daemon=True)
        t.start()

    bus.on("requisition.published", _on_requisition_published_bus)
    bus.on("requisition.created", _on_requisition_published_bus)
except Exception as bus_err:
    logger.warning(f"Could not bind requisition lifecycle to outreach: {bus_err}")



@app.get("/api/public/outreach/{token}/respond")
@app.post("/api/public/outreach/{token}/respond")
def candidate_outreach_respond(request: Request, token: str, action: str = "interested"):
    """
    Public interactive response endpoint triggered when a candidate clicks
    [Available & Interested] or [Not Available] in their email, telegram, or in-app notification.
    Supports both HTML landing pages and JSON responses for in-app React integration.
    """
    from modules.candidate.outreach_service import handle_candidate_rsvp

    origin = None
    if request:
        origin = request.headers.get("origin") or request.headers.get("referer")
        if origin:
            parts = origin.split("://")
            if len(parts) == 2:
                domain_part = parts[1].split("/")[0]
                origin = f"{parts[0]}://{domain_part}"

    res = handle_candidate_rsvp(token, action, origin=origin)

    # Return JSON if requested by React frontend
    accept = request.headers.get("accept", "")
    if "application/json" in accept or request.method == "POST" or request.query_params.get("format") == "json":
        status_code = 200 if res.get("success") else 400
        return JSONResponse(content=res, status_code=status_code)

    if res.get("error"):
        return HTMLResponse(
            status_code=400,
            content=f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verification Error - TermJobs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ margin:0; padding:0; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }}
    .card {{ background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:36px; max-width:480px; width:90%; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.05); }}
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:36px; margin-bottom:16px;">⚠️</div>
    <h2 style="margin:0 0 12px 0; color:#0f172a;">Link Expired or Invalid</h2>
    <p style="color:#64748b; font-size:14px; line-height:1.5;">{res.get('error')}</p>
    <a href="/" style="display:inline-block; margin-top:20px; background:#0a0a0a; color:#ffffff; padding:10px 20px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:bold;">Return to Homepage</a>
  </div>
</body>
</html>"""
        )

    cand_name = res.get("candidate_name", "Candidate")
    req_title = res.get("requisition_title", "Position")
    comp_name = res.get("company_name", "Hiring Team")
    act = res.get("action")
    meeting_link = res.get("meeting_link")
    portal_link = res.get("candidate_portal_link")
    passcode = res.get("candidate_passcode") or "TJ-FAST-TRACK"

    interview_box = ""
    if act == "interested" and meeting_link:
        interview_box = f"""
    <div style="margin: 20px 0; padding: 20px; background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 14px; text-align: center;">
      <div style="font-size: 13px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
        🤖 Your AI Interview is Ready
      </div>
      <div style="margin: 14px 0;">
        <a href="{meeting_link}" target="_blank" style="display: inline-block; background: #059669; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(5,150,105,0.25);">
          Start AI Interview &rarr;
        </a>
      </div>
      <div style="font-size: 12px; color: #374151; margin-top: 10px;">
        Candidate Access Passcode: <code style="background: #ffffff; padding: 4px 8px; border-radius: 6px; font-weight: 800; border: 1px solid #d1d5db; font-family: monospace;">{passcode}</code>
      </div>
      <div style="margin-top: 12px;">
        <a href="{portal_link}" target="_blank" style="font-size: 12px; color: #059669; text-decoration: underline;">
          Or login via Candidate Interview Portal
        </a>
      </div>
    </div>
"""

    if act == "interested":
        headline = "Availability & Interest Confirmed!"
        badge_bg = "#ecfdf5"
        badge_color = "#059669"
        icon = "✓"
        desc = f"Thank you, <strong>{cand_name}</strong>! We've notified <strong>{comp_name}</strong> that you are available and interested in the <strong>{req_title}</strong> role."
        sub_desc = "Your profile has been fast-tracked into the active interview screening pipeline. Your AI interview link is ready above."
        email_status = (res.get("interview_email_delivery") or {}).get("status")
        if email_status == "success":
            sub_desc += " Your AI interview link has also been emailed to you. Please check your inbox and spam folder."
        elif email_status == "sending":
            sub_desc += " Your AI interview email is being sent. You can also use the link above."
        else:
            sub_desc += " We could not send the interview email. You can join using the link above or click Yes in your invitation again to retry email delivery."
    elif act == "unavailable":
        headline = "Status Successfully Updated"
        badge_bg = "#f1f5f9"
        badge_color = "#475569"
        icon = "✓"
        desc = f"Thank you for letting us know, <strong>{cand_name}</strong>. Congratulations if you've recently taken another role!"
        sub_desc = "We have updated your record so our talent coordinators will not disturb you while you are unavailable."
    else:
        headline = "Feedback Recorded"
        badge_bg = "#f8fafc"
        badge_color = "#64748b"
        icon = "ℹ"
        desc = f"We've noted that you are passing on the <strong>{req_title}</strong> role at this time."
        sub_desc = "We will keep your profile in our candidate pool and notify you when other roles matching your skillset open up."

    return HTMLResponse(
        content=f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{headline} - TermJobs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ margin:0; padding:0; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }}
    .card {{ background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; padding:44px 32px; max-width:520px; width:90%; text-align:center; box-shadow:0 12px 30px rgba(0,0,0,0.06); }}
    .icon-badge {{ width:64px; height:64px; border-radius:50%; background:{badge_bg}; color:{badge_color}; display:inline-flex; align-items:center; justify-content:center; font-size:28px; font-weight:bold; margin-bottom:20px; }}
    h1 {{ font-size:22px; font-weight:800; color:#0f172a; margin:0 0 16px 0; }}
    p {{ color:#475569; font-size:14px; line-height:1.6; margin:0 0 12px 0; }}
    .highlight-box {{ background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin:20px 0; text-align:left; font-size:13px; color:#334155; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">{icon}</div>
    <h1>{headline}</h1>
    <p>{desc}</p>
    <div class="highlight-box">
      <strong>Position:</strong> {req_title}<br/>
      <strong>Hiring Partner:</strong> {comp_name}
    </div>
    {interview_box}
    <p style="font-size:12.5px; color:#64748b;">{sub_desc}</p>
    <div style="margin-top:28px; border-top:1px solid #f1f5f9; padding-top:20px; font-size:11px; color:#94a3b8;">
      TermJobs Automated Talent Network &bull; Secured with Verified RSVP Token
    </div>
  </div>
</body>
</html>"""
    )


@app.get("/api/superadmin/outreach/stats")
def get_superadmin_outreach_stats(current_user: User = Depends(get_current_user)) -> dict:
    """Super Admin Control Panel: Global candidate email outreach analytics."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")
    from modules.candidate.outreach_service import get_outreach_stats_summary
    return get_outreach_stats_summary()


@app.get("/api/superadmin/outreach/requisitions")
def get_superadmin_outreach_requisitions(current_user: User = Depends(get_current_user)) -> list:
    """Super Admin Control Panel: List requisitions for matching & outreach launcher."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")

    from modules.shared.db import db
    req_docs = list(
        db["requisitions"]
        .find(
            {"status": {"$in": ["Published", "Active", "Open"]}},
            {"id": 1, "title": 1, "company_name": 1, "status": 1, "skills": 1, "last_ai_outreach_at": 1, "ai_outreach_candidate_count": 1}
        )
        .sort("created_at", -1)
    )
    
    # Calculate outreach stats for each requisition
    outreach_counts = {}
    for o in db["candidate_outreach"].find({}, {"requisition_id": 1, "status": 1}):
        rid = o.get("requisition_id")
        if rid:
            if rid not in outreach_counts:
                outreach_counts[rid] = {"total": 0, "interested": 0, "unavailable": 0}
            outreach_counts[rid]["total"] += 1
            if o.get("status") == "interested":
                outreach_counts[rid]["interested"] += 1
            elif o.get("status") == "unavailable":
                outreach_counts[rid]["unavailable"] += 1

    results = []
    for r in req_docs:
        rid = r.get("id")
        stats = outreach_counts.get(rid, {"total": 0, "interested": 0, "unavailable": 0})
        results.append({
            "id": rid,
            "title": r.get("title") or "Open Position",
            "company_name": r.get("company_name") or "Enterprise Partner",
            "status": r.get("status") or "ACTIVE",
            "skills": r.get("skills") or [],
            "outreach_stats": stats,
            "last_outreach_at": r.get("last_ai_outreach_at"),
        })
    return results


@app.get("/api/superadmin/outreach/requisition/{requisition_id}")
def get_superadmin_requisition_outreach(
    requisition_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Super Admin Control Panel: Top 20 ranked candidates and their live email outreach status."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")
    from modules.candidate.outreach_service import get_requisition_outreach_details
    return get_requisition_outreach_details(requisition_id)


@app.post("/api/superadmin/outreach/trigger/{requisition_id}")
def trigger_superadmin_requisition_outreach(
    requisition_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Super Admin Control Panel: Manually trigger Top 20 candidate match and email dispatch."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")
    from modules.candidate.outreach_service import dispatch_outreach_to_top_candidates
    return dispatch_outreach_to_top_candidates(requisition_id, limit=20, force_resend=True)


@app.post("/api/superadmin/outreach/send-test-telegram")
def send_test_telegram_alert_endpoint(
    payload: dict,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Super Admin Control Panel: Send a live test Telegram alert to a candidate or chat_id."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")
    
    chat_id = payload.get("chat_id")
    email = (payload.get("email") or "").strip().lower()
    requisition_id = payload.get("requisition_id")
    
    from modules.shared.db import db
    from modules.candidate.telegram_service import send_candidate_requisition_alert
    import asyncio
    import secrets
    import concurrent.futures
    
    if not chat_id and email:
        cand = db["candidates"].find_one({"candidate_email": email})
        if cand:
            chat_id = cand.get("telegram_chat_id")
        if not chat_id:
            tlink = db["telegram_links"].find_one({"candidate_email": email})
            if tlink:
                chat_id = tlink.get("chat_id")
                
    if not chat_id:
        cand_with_tg = db["candidates"].find_one({"telegram_chat_id": {"$exists": True, "$ne": None, "$ne": ""}})
        if cand_with_tg:
            chat_id = cand_with_tg.get("telegram_chat_id")
            
    if not chat_id:
        raise HTTPException(status_code=400, detail="No connected Telegram Chat ID found. Please link via @Termjobs_alertbot first.")
        
    req = db["requisitions"].find_one({"id": requisition_id}) if requisition_id else (
        db["requisitions"].find_one({"status": {"$in": ["Published", "Active", "Open"]}}) or db["requisitions"].find_one({})
    )
    if not req:
        raise HTTPException(status_code=404, detail="No active requisition found to test with.")
        
    cand_info = {
        "candidate_name": getattr(current_user, "name", "Super Admin"),
        "candidate_email": email or getattr(current_user, "email", "admin@termjobs.in"),
        "id": str(current_user.id)
    }
    
    token = secrets.token_urlsafe(24)
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
        
    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor() as pool:
            res = pool.submit(asyncio.run, send_candidate_requisition_alert(
                chat_id=chat_id,
                requisition=req,
                candidate=cand_info,
                outreach_token=token,
                match_score=98.0,
                match_reasons=["Direct Admin Live Test", "Telegram delivery verified"]
            )).result()
    else:
        res = asyncio.run(send_candidate_requisition_alert(
            chat_id=chat_id,
            requisition=req,
            candidate=cand_info,
            outreach_token=token,
            match_score=98.0,
            match_reasons=["Direct Admin Live Test", "Telegram delivery verified"]
        ))
        
    return {"status": "success", "chat_id": chat_id, "telegram_result": res}


@app.get("/api/superadmin/outreach/settings")
def get_superadmin_outreach_settings(current_user: User = Depends(get_current_user)) -> dict:
    """Get automated candidate outreach system settings."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")
    from modules.shared.db import db
    doc = db["system_settings"].find_one({"key": "auto_outreach_enabled"})
    enabled = doc.get("value", True) if doc else True
    return {"auto_outreach_enabled": enabled}


@app.post("/api/superadmin/outreach/settings")
def update_superadmin_outreach_settings(
    payload: dict,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update automated candidate outreach system settings."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")
    from modules.shared.db import db
    enabled = bool(payload.get("auto_outreach_enabled", True))
    db["system_settings"].update_one(
        {"key": "auto_outreach_enabled"},
        {"$set": {"key": "auto_outreach_enabled", "value": enabled, "updated_at": _utcnow().isoformat()}},
        upsert=True
    )
    return {"auto_outreach_enabled": enabled, "message": "Settings updated successfully."}


@app.get("/api/superadmin/outreach/activity")
def get_superadmin_outreach_activity(current_user: User = Depends(get_current_user)) -> list:
    """Recent live email & Telegram outreach activity feed for Super Admin."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")
    from modules.shared.db import db
    records = list(db["candidate_outreach"].find({}, {"html_preview": 0}).sort("sent_at", -1).limit(40))
    for r in records:
        r["_id"] = str(r["_id"])
    return records


# --- Telegram Bot Endpoints & Lifecycle ---




@app.get("/api/telegram/status")
async def get_telegram_status_endpoint():
    """Returns real-time status of Telegram Bot connection."""
    from modules.candidate.telegram_service import get_bot_info, get_telegram_bot_username
    info = await get_bot_info()
    username = get_telegram_bot_username()
    return {
        "bot_username": username,
        "bot_link": f"https://t.me/{username}",
        "connected": info.get("ok", False),
        "details": info.get("result", {})
    }


@app.post("/api/telegram/webhook")
async def telegram_webhook_endpoint(request: Request):
    """Optional webhook endpoint for Telegram updates (in addition to long-polling)."""
    try:
        update = await request.json()
        from modules.candidate.telegram_service import process_telegram_update
        await process_telegram_update(update)
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@app.post("/api/telegram/send-test")
async def telegram_send_test_endpoint(payload: dict, current_user: User = Depends(get_current_user)):
    """Allows Super Admin to test send an interactive Telegram alert card."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Super Admin authorization required.")
    chat_id = payload.get("chat_id")
    if not chat_id:
        raise HTTPException(status_code=400, detail="chat_id is required.")
    
    from modules.candidate.telegram_service import send_candidate_requisition_alert
    sample_req = {
        "id": "DEMO-REQ-001",
        "title": "Lead Software Architect",
        "company_name": "TermJobs Enterprise",
        "skills": ["Python", "FastAPI", "Microservices", "Cloud"],
    }
    sample_cand = {
        "candidate_name": current_user.name or "Administrator",
        "id": current_user.id
    }
    res = await send_candidate_requisition_alert(
        chat_id=chat_id,
        requisition=sample_req,
        candidate=sample_cand,
        outreach_token="test_demo_token",
        match_score=96.0,
        match_reasons=["Direct Skill Match: Python, FastAPI", "Seniority matches job criteria"]
    )
    return res


@app.get("/requisitions/{requisition_id}")
@app.get("/api/requisitions/{requisition_id}")
def get_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _auto_close_expired()
    req = _get_requisition(requisition_id)
    _require_tenant(req, current_user)
    is_vendor = str(getattr(current_user, "role", "") or "") == "Recruiter"
    if is_vendor and req.status != schemas.RequisitionStatus.PUBLISHED.value:
        raise HTTPException(status_code=403, detail="This requisition is not published to vendors yet.")
    return _requisition_dict(requisition_id, for_vendor=is_vendor)


@app.post("/requisitions/{requisition_id}/start")
def start_requisition_flow(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    state, interrupt = service.start_intake(requisition_id)
    _cache.clear()
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/answer")
def answer_intake_question(requisition_id: str, body: AnswerIn, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    state, interrupt = service.answer(requisition_id, body.answer)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/refine")
def refine_requisition_jd(requisition_id: str, body: RefineIn, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    try:
        state, interrupt = service.refine(requisition_id, body.instruction)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _interrupt_payload(state, interrupt)


class UpdateRequisitionRoleIn(BaseModel):
    structured_role: dict | None = None
    title: str | None = None
    generated_jd_markdown: str | None = None

    @field_validator("structured_role")
    @classmethod
    def validate_deadline(cls, value):
        validate_submission_deadline((value or {}).get("submission_deadline"))
        return value


@app.patch("/requisitions/{requisition_id}")
@app.patch("/api/requisitions/{requisition_id}")
def update_requisition_role(
    requisition_id: str,
    body: UpdateRequisitionRoleIn,
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_writable(current_user)
    req = _get_requisition(requisition_id)
    _require_tenant(req, current_user)
    with get_session() as session:
        db_req = session.get(models.Requisition, requisition_id)
        if not db_req:
            raise HTTPException(status_code=404, detail="Requisition not found")
        if body.structured_role:
            cur = dict(db_req.structured_role or {})
            cur.update(body.structured_role)
            db_req.structured_role = cur
            if not body.title and cur.get("title"):
                db_req.title = cur.get("title")
        if body.title:
            db_req.title = body.title
        if body.generated_jd_markdown:
            db_req.generated_jd_markdown = body.generated_jd_markdown
        session.commit()
    _cache.clear()
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/approve")
@app.post("/api/requisitions/{requisition_id}/approve")
def approve_requisition(requisition_id: str, body: ApproveIn | None = None, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    req_dict = _get_requisition(requisition_id)
    _require_tenant(req_dict, current_user)
    _ensure_chat_requisition_complete(req_dict)
    _require_approval_deadline(requisition_id)
    status_str = str(req_dict.status or "").lower()
    if status_str in ("published", "active") and str(current_user.role or "").strip().lower() in ("hiring manager", "hiring_manager"):
        raise HTTPException(status_code=400, detail="This requisition is already approved, and cannot be edited.")
    edited = None
    if body and body.edited_role:
        try:
            edited = schemas.StructuredRole.model_validate(body.edited_role)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=422, detail=f"invalid edited_role: {exc}")

    reviewer = body.reviewer if body else None
    try:
        service.approve(requisition_id, reviewer=reviewer, edited_role=edited)
    except Exception:
        pass

    with get_session() as session:
        db_req = session.get(models.Requisition, requisition_id)
        if db_req:
            db_req.status = schemas.RequisitionStatus.PENDING_APPROVAL.value
            db_req.rejection_reason = None
            db_req.rejected_by = None
            db_req.rejected_at = None
            if edited:
                db_req.structured_role = edited.model_dump()
            if current_user.role in ("Director", "Admin", "Super Admin"):
                now_dt = _utcnow()
                db_req.director_approved = True
                db_req.director_approved_by = current_user.name or current_user.email or "Director"
                db_req.director_approved_at = now_dt
                db_req.approved_by = current_user.name or current_user.email or "Director"
                db_req.approved_at = now_dt
            else:
                db_req.director_approved = False
                db_req.director_approved_by = None
                db_req.director_approved_at = None
            session.commit()

    try:
        from modules.shared.db import db
        now_iso = _utcnow().isoformat()
        db["requisitions"].update_one(
            {"id": requisition_id},
            {"$set": {
                "status": "Pending Approval",
                "director_approved": False,
                "updated_at": now_iso
            }}
        )
        if current_user.role not in ("Director", "Admin", "Super Admin"):
            req_title = db_req.title if db_req else "Job Requisition"
            db["notifications"].insert_one({
                "id": str(uuid.uuid4()),
                "tenant_id": str(current_user.tenant_id or "local"),
                "type": "requisition_approval_request",
                "title": f"New Requisition Approval Request: {req_title}",
                "message": f"{current_user.name or 'Hiring Manager'} submitted requisition '{req_title}' for Director approval.",
                "requisition_id": requisition_id,
                "target_role": "Director",
                "status": "unread",
                "created_at": now_iso
            })
    except Exception:
        pass

    _cache.clear()
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/director-approve")
@app.post("/api/requisitions/{requisition_id}/director-approve")
def director_approve_requisition(
    requisition_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user)
) -> dict:
    if current_user.role not in ("Director", "Admin", "Super Admin"):
        raise HTTPException(
            status_code=403,
            detail="Only Directors or Admins can approve requisitions.",
        )
    req = _get_requisition(requisition_id)
    _require_tenant(req, current_user)

    _require_approval_deadline(requisition_id)
    with get_session() as session:
        db_req = session.get(models.Requisition, requisition_id)
        if db_req is None:
            raise HTTPException(status_code=404, detail="Requisition not found")
        if db_req:
            now_dt = _utcnow()
            db_req.status = schemas.RequisitionStatus.PUBLISHED.value
            db_req.director_approved = True
            db_req.director_approved_by = current_user.name or current_user.email or "Director"
            db_req.director_approved_at = now_dt
            db_req.approved_by = current_user.name or current_user.email or "Director"
            db_req.approved_at = now_dt
            db_req.rejection_reason = None
            db_req.rejected_by = None
            db_req.rejected_at = None
            session.commit()

    # Session already persists to MongoDB; no second publish or mirrored write is needed.
    background_tasks.add_task(notify_requisition_published, requisition_id)

    _cache.clear()
    background_tasks.add_task(_async_trigger_top_candidate_outreach, requisition_id)
    return {"id": db_req.id, "status": db_req.status,
            "director_approved": True, "director_approved_by": db_req.director_approved_by,
            "director_approved_at": _format_datetime(db_req.director_approved_at),
            "approved_by": db_req.approved_by, "approved_at": _format_datetime(db_req.approved_at)}


@app.post("/requisitions/{requisition_id}/reject")
@app.post("/api/requisitions/{requisition_id}/reject")
def reject_requisition(requisition_id: str, body: RejectIn | None = None, current_user: User = Depends(get_current_user)) -> dict:
    if current_user.role not in ("Director", "Admin", "Super Admin"):
        raise HTTPException(status_code=403, detail="Only Directors or Admins can reject requisitions.")
    _require_tenant(_get_requisition(requisition_id), current_user)

    reviewer = (body.reviewer if body else None) or current_user.name or current_user.email or "Director"
    reason = (body.reason if body and body.reason else None) or "Revision requested by Director"

    with get_session() as session:
        db_req = session.get(models.Requisition, requisition_id)
        if db_req is None:
            raise HTTPException(status_code=404, detail="Requisition not found")
        if db_req:
            db_req.status = schemas.RequisitionStatus.RESTRUCTURING.value
            db_req.director_approved = False
            db_req.director_approved_by = None
            db_req.director_approved_at = None
            db_req.rejection_reason = reason
            db_req.rejected_by = reviewer
            db_req.rejected_at = _utcnow()
            session.commit()

    # A director decision must not resume the AI intake graph or regenerate the JD.
    service._record_review(requisition_id, reviewer, "rejected")

    try:
        from modules.shared.db import db
        db["requisitions"].update_one(
            {"id": requisition_id},
            {"$set": {
                "status": "Restructuring",
                "director_approved": False,
                "rejection_reason": reason,
                "rejected_by": reviewer,
                "rejected_at": _format_datetime(db_req.rejected_at),
            }}
        )
    except Exception:
        pass

    _cache.clear()
    return {"id": db_req.id, "status": db_req.status, "director_approved": False,
            "rejection_reason": reason, "rejected_by": reviewer,
            "rejected_at": _format_datetime(db_req.rejected_at)}


@app.post("/requisitions/{requisition_id}/submit-for-approval")
@app.post("/api/requisitions/{requisition_id}/submit-for-approval")
def submit_requisition_for_director_approval_route(
    requisition_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user)
) -> dict:
    req = _get_requisition(requisition_id)
    _require_tenant(req, current_user)
    _ensure_chat_requisition_complete(req)

    _require_approval_deadline(requisition_id, allow_resubmission=True)
    now_iso = _utcnow().isoformat()
    with get_session() as session:
        db_req = session.get(models.Requisition, requisition_id)
        if db_req:
            db_req.rejection_reason = None
            db_req.rejected_by = None
            db_req.rejected_at = None
            db_req.updated_at = _utcnow()
            db_req.status = "Pending Approval"
            db_req.director_approved = False
            db_req.director_approved_by = None
            db_req.director_approved_at = None
            db_req.approved_by = None
            db_req.approved_at = None
            session.commit()

    try:
        from modules.shared.db import db
        db["notifications"].insert_one({
            "id": str(uuid.uuid4()),
            "tenant_id": str(current_user.tenant_id or "local"),
            "type": "requisition_approval_request",
            "title": f"New Requisition Approval Request: {req.title}",
            "message": f"{current_user.name or 'Hiring Manager'} submitted requisition '{req.title}' for Director approval.",
            "requisition_id": requisition_id,
            "target_role": "Director",
            "status": "unread",
            "created_at": now_iso
        })
    except Exception as e:
        logger.warning(f"Failed to dispatch Director notification: {e}")

    _cache.clear()
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/publish")
@app.post("/api/requisitions/{requisition_id}/publish")
def publish_requisition(
    requisition_id: str,
    body: ApproveByIn | None = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user)
) -> dict:
    req = _get_requisition(requisition_id)
    _require_tenant(req, current_user)
    _ensure_chat_requisition_complete(req)

    _require_approval_deadline(requisition_id)
    db_req = _get_requisition(requisition_id)
    is_director_or_admin = current_user.role in ("Director", "Admin", "Super Admin")

    if not getattr(db_req, "director_approved", False) and not is_director_or_admin:
        raise HTTPException(
            status_code=400,
            detail="Requisition requires Director approval before it can be published to vendors.",
        )

    if is_director_or_admin and not getattr(db_req, "director_approved", False):
        with get_session() as session:
            s_req = session.get(models.Requisition, requisition_id)
            if s_req:
                now_dt = _utcnow()
                s_req.director_approved = True
                s_req.director_approved_by = current_user.name or current_user.email or "Director"
                s_req.director_approved_at = now_dt
                s_req.approved_by = current_user.name or current_user.email or "Director"
                s_req.approved_at = now_dt
                session.commit()

    by = body.by if body else (current_user.name or current_user.email)
    try:
        req = service.publish(requisition_id, by=by)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    try:
        notify_requisition_published(requisition_id)
    except Exception:  # noqa: BLE001
        pass

    # Sync status to MongoDB
    try:
        from modules.shared.db import db
        now_dt = _utcnow()
        deadline_dt = now_dt + timedelta(hours=48)
        now_iso = now_dt.isoformat()
        db["requisitions"].update_one(
            {"id": requisition_id},
            {"$set": {
                "status": schemas.RequisitionStatus.PUBLISHED.value,
                "shortlist_window_hours": 48,
                "shortlist_deadline": deadline_dt.isoformat(),
                "shortlist_dispatched": False,
                "shortlist_auto_sent": False,
                "shortlist_instant_sent": False,
                "shortlist_candidate_count": 0,
                "updated_at": now_iso,
            }},
            upsert=True
        )
    except Exception:
        pass

    _cache.clear()
    background_tasks.add_task(_async_trigger_top_candidate_outreach, requisition_id)
    return _requisition_dict(requisition_id)


# --- 48-Hour Shortlist & Instant Send Endpoints ---

@app.get("/requisitions/{requisition_id}/shortlist/status")
@app.get("/api/requisitions/{requisition_id}/shortlist/status")
def get_requisition_shortlist_status_endpoint(
    requisition_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return real-time 48-hour sourcing window countdown and shortlist status."""
    cache_key = f"shortlist_status:{requisition_id}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached
    from modules.candidate.shortlist_service import get_requisition_shortlist_status
    result = get_requisition_shortlist_status(requisition_id)
    _cache.set(cache_key, result, ttl=20)
    return result


@app.post("/requisitions/{requisition_id}/shortlist/send-now")
@app.post("/api/requisitions/{requisition_id}/shortlist/send-now")
def send_requisition_shortlist_now_endpoint(
    requisition_id: str,
    body: dict | None = None,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Instantly dispatch the current candidate shortlist to the Hiring Manager before 48h."""
    from modules.candidate.shortlist_service import dispatch_requisition_shortlist
    notes = (body or {}).get("notes")
    actor_name = current_user.name or current_user.email or "Recruiter"
    actor_label = f"{actor_name} ({current_user.role})"
    res = dispatch_requisition_shortlist(
        requisition_id=requisition_id,
        dispatched_by=actor_label,
        is_auto=False,
        notes=notes,
    )
    _cache.clear()
    return res


@app.post("/requisitions/{requisition_id}/shortlist/generate")
@app.post("/api/requisitions/{requisition_id}/shortlist/generate")
def generate_requisition_shortlist_endpoint(
    requisition_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Generate or update the shortlisted candidate list using our ranking algorithm."""
    from modules.candidate.shortlist_service import generate_and_rank_requisition_shortlist
    res = generate_and_rank_requisition_shortlist(requisition_id)
    _cache.clear()
    return res


# --- Candidate Employment Offer Letter Endpoints ---

@app.get("/api/candidates/{candidate_id}/offer-letter")
@app.get("/candidates/{candidate_id}/offer-letter")
def get_candidate_offer_letter_endpoint(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Retrieve existing or generated formal employment offer letter for candidate."""
    from datetime import datetime, timezone, timedelta
    from modules.shared.db import db, get_session
    from modules.candidate.domain.models import CandidateSubmission
    now = datetime.now(timezone.utc)
    
    raw_id = candidate_id.replace("CND-", "").strip()

    cand_name = "Candidate Name"
    cand_email = ""
    req_title = ""
    req_id = ""
    company_name = ""

    # 1. Query candidate_selections collection FIRST (official hiring manager selections)
    try:
        sel = db["candidate_selections"].find_one({
            "$or": [
                {"id": candidate_id},
                {"selection_id": candidate_id},
                {"submission_id": candidate_id},
                {"candidate_id": candidate_id},
                {"id": raw_id},
                {"candidate_id": raw_id},
                {"submission_id": raw_id},
            ]
        })
        if sel:
            if sel.get("candidate_name"):
                cand_name = sel.get("candidate_name")
            if sel.get("candidate_email"):
                cand_email = sel.get("candidate_email")
            if sel.get("requisition_title"):
                req_title = sel.get("requisition_title")
            if sel.get("company_name"):
                company_name = sel.get("company_name")
            if sel.get("requisition_id"):
                req_id = sel.get("requisition_id")
    except Exception as e:
        logger.warning(f"Error checking candidate_selections for offer letter: {e}")
    
    # 2. Query SQLite CandidateSubmission
    try:
        with get_session() as session:
            sub = session.get(CandidateSubmission, candidate_id)
            if not sub:
                sub = session.query(CandidateSubmission).filter(
                    (CandidateSubmission.id == candidate_id) |
                    (CandidateSubmission.id == raw_id) |
                    (CandidateSubmission.id.like(f"%{raw_id}%"))
                ).first()
            if sub:
                if sub.candidate_name and (cand_name == "Candidate Name" or not cand_name):
                    cand_name = sub.candidate_name
                if sub.candidate_email and not cand_email:
                    cand_email = sub.candidate_email
                if sub.requisition_id and not req_id:
                    req_id = sub.requisition_id
    except Exception as e:
        logger.warning(f"Error checking SQLite CandidateSubmission for offer letter: {e}")

    # 3. Query MongoDB candidate_submissions and candidates
    try:
        cand_doc = db["candidate_submissions"].find_one({
            "$or": [
                {"id": candidate_id},
                {"candidate_id": candidate_id},
                {"submission_id": candidate_id},
                {"id": raw_id},
                {"candidate_id": raw_id},
                {"submission_id": raw_id},
            ]
        })
        if not cand_doc:
            cand_doc = db["candidates"].find_one({
                "$or": [
                    {"id": candidate_id},
                    {"candidate_id": candidate_id},
                    {"id": raw_id},
                ]
            })
        if cand_doc:
            if cand_doc.get("candidate_name") and (cand_name == "Candidate Name" or not cand_name):
                cand_name = cand_doc.get("candidate_name")
            if not cand_email:
                cand_email = cand_doc.get("candidate_email") or cand_doc.get("email") or ""
            if not req_id:
                req_id = cand_doc.get("requisition_id") or ""
            if cand_doc.get("requisition_title") and not req_title:
                req_title = cand_doc.get("requisition_title")
            if cand_doc.get("company_name") and not company_name:
                company_name = cand_doc.get("company_name")
    except Exception as e:
        logger.warning(f"Error checking Mongo for candidate offer letter: {e}")

    # 4. Lookup requisition title & company name from requisition record
    if req_id:
        try:
            from modules.requisition.domain.models import Requisition
            with get_session() as session:
                req_obj = session.get(Requisition, req_id)
                if req_obj:
                    if not req_title or req_title == "DevSecOps Engineer":
                        req_title = req_obj.title or req_title
                    comp_struct = req_obj.structured_role or {}
                    if not company_name or company_name == "TCS":
                        company_name = comp_struct.get("company_name") or req_obj.company_name or company_name
        except Exception as e:
            logger.warning(f"Error checking Requisition for offer letter: {e}")

    # Fallbacks if still unresolved
    if not req_title:
        req_title = "Senior Software Engineer"
    if not company_name:
        company_name = getattr(current_user, "tenant_name", None) or "Enterprise Partner"

    # 5. Check existing offer letter in MongoDB
    try:
        from bson import ObjectId
        existing = db["offer_letters"].find_one({
            "$or": [
                {"candidate_id": candidate_id},
                {"submission_id": candidate_id},
                {"candidate_id": raw_id},
                {"submission_id": raw_id},
                {"candidate_email": cand_email.lower()} if cand_email else {"candidate_id": candidate_id},
            ]
        })
        if existing:
            mongo_id = existing.get("_id")
            existing["_id"] = str(mongo_id)
            dirty = False
            # Upgrade placeholder candidate name or empty email
            if cand_name and cand_name != "Candidate Name" and (not existing.get("candidate_name") or existing.get("candidate_name") == "Candidate Name"):
                existing["candidate_name"] = cand_name
                dirty = True
            if cand_email and not existing.get("candidate_email"):
                existing["candidate_email"] = cand_email
                dirty = True
            # Correct mismatched or defaulted job_title (e.g. was DevSecOps Engineer when candidate was selected for Senior Backend)
            if req_title and req_title != existing.get("job_title"):
                # If existing is DevSecOps Engineer or generic fallback, replace with true selected role
                if existing.get("job_title") in ["DevSecOps Engineer", "Position", "Software Professional", "", None] or req_title:
                    existing["job_title"] = req_title
                    dirty = True
            # Correct mismatched or defaulted company name (e.g. was TCS when candidate was selected for Private A)
            if company_name and company_name != existing.get("company_name"):
                if existing.get("company_name") in ["TCS", "Enterprise Partner", "", None] or company_name:
                    existing["company_name"] = company_name
                    dirty = True
            if dirty and mongo_id:
                try:
                    db["offer_letters"].update_one(
                        {"_id": mongo_id},
                        {"$set": {
                            "candidate_name": existing.get("candidate_name"),
                            "candidate_email": existing.get("candidate_email"),
                            "job_title": existing.get("job_title"),
                            "company_name": existing.get("company_name"),
                            "updated_at": now.isoformat(),
                        }}
                    )
                except Exception as update_err:
                    logger.warning(f"Error auto-syncing offer letter fields: {update_err}")
            return {"status": "success", "offer": existing}
    except Exception as e:
        logger.warning(f"Error checking existing offer letter: {e}")

    default_joining = (now + timedelta(days=14)).strftime("%d %B %Y")
    today_str = now.strftime("%d %B %Y")

    # Determine department based on job title
    dept = "Platform & Software Engineering"
    title_lower = (req_title or "").lower()
    if any(k in title_lower for k in ["qa", "test", "automation", "quality"]):
        dept = "Quality Assurance & Testing"
    elif any(k in title_lower for k in ["backend", "python", "fastapi", "django", "node", "golang", "java", "sql"]):
        dept = "Backend & Systems Engineering"
    elif any(k in title_lower for k in ["frontend", "react", "vue", "web", "ui"]):
        dept = "Frontend & Product Engineering"
    elif any(k in title_lower for k in ["devops", "cloud", "aws", "sre", "infrastructure", "devsecops"]):
        dept = "Cloud & Platform Engineering"

    # Standard Annexure A compensation breakdown: Total CTC 18,00,000 INR
    annual_ctc = 1800000
    monthly_ctc = annual_ctc // 12
    basic_annual = int(annual_ctc * 0.50)
    hra_annual = int(annual_ctc * 0.25)
    other_annual = int(annual_ctc * 0.15)
    pf_annual = int(annual_ctc * 0.10)

    default_offer = {
        "candidate_id": candidate_id,
        "submission_id": candidate_id,
        "company_name": company_name,
        "company_address": "Corporate Technology Park, Outer Ring Road, Bengaluru, Karnataka 560103",
        "candidate_name": cand_name,
        "candidate_email": cand_email,
        "job_title": req_title,
        "offer_date": today_str,
        "joining_date": default_joining,
        "mobility_clause": "You should be aware that you might be subject to transfer to another city or location where the Company operates a business or will operate a business in the future, to carry on similar responsibilities whenever the requirement arises.",
        "contract_period": "Full Time / Unlimited",
        "leave_policy": {
            "earned_leave": 18,
            "casual_leave": 12,
            "sick_leave": 12,
            "restricted_holidays": 3,
        },
        "termination_company_notice_days": 30,
        "termination_employee_notice_days": 30,
        "probation_period_months": 3,
        "non_compete_period": "12 months",
        "annexure": {
            "grade": "Band L4 / Senior Specialist",
            "department": dept,
            "reporting_to": "Engineering Director / Hiring Lead",
            "work_location": "Bengaluru / Hybrid",
            "contract_type": "Full Time",
            "currency": "INR (₹)",
            "basic_salary_annual": basic_annual,
            "basic_salary_monthly": basic_annual // 12,
            "hra_annual": hra_annual,
            "hra_monthly": hra_annual // 12,
            "other_allowance_annual": other_annual,
            "other_allowance_monthly": other_annual // 12,
            "pf_annual": pf_annual,
            "pf_monthly": pf_annual // 12,
            "total_fixed_annual": annual_ctc,
            "total_fixed_monthly": monthly_ctc,
            "meal_voucher_monthly": 3000,
            "annual_bonus_percentage": 10,
            "medical_insurance_coverage": "₹5,00,000 for employee, spouse, children & parents",
            "life_insurance_coverage": "Group Life Insurance policy up to 3x Annual CTC",
            "gratuity_terms": "As per Payment of Gratuity Act, 1972",
        },
        "hr_signatory_name": getattr(current_user, "name", None) or "Rakesh Sharma",
        "hr_signatory_title": "VP – Human Resources",
        "status": "Draft",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    return {"status": "success", "offer": default_offer}


@app.post("/api/candidates/{candidate_id}/offer-letter")
@app.post("/candidates/{candidate_id}/offer-letter")
def save_candidate_offer_letter_endpoint(
    candidate_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Save or update custom editable employment offer letter for candidate."""
    from datetime import datetime, timezone
    import re
    from modules.shared.db import db
    now_iso = datetime.now(timezone.utc).isoformat()
    
    offer_data = payload.get("offer", payload)
    offer_data["candidate_id"] = candidate_id
    offer_data["updated_at"] = now_iso
    offer_data["updated_by"] = getattr(current_user, "email", None) or getattr(current_user, "name", None) or "HR"
    if "status" not in offer_data:
        offer_data["status"] = "Offer Extended"
    if "agreement_status" not in offer_data:
        offer_data["agreement_status"] = "Pending Signature"

    cand_email = (offer_data.get("candidate_email") or "").strip().lower()
    cand_name = (offer_data.get("candidate_name") or "").strip()
    raw_id = candidate_id.replace("CND-", "").replace("BEAR-", "").strip()

    match_or = [
        {"candidate_id": candidate_id},
        {"submission_id": candidate_id},
        {"id": candidate_id},
    ]
    if raw_id:
        match_or.extend([
            {"candidate_id": raw_id},
            {"submission_id": raw_id},
            {"id": raw_id},
        ])
    if cand_email:
        match_or.extend([
            {"candidate_email": cand_email},
            {"candidate_email": {"$regex": f"^{re.escape(cand_email)}$", "$options": "i"}},
            {"email": {"$regex": f"^{re.escape(cand_email)}$", "$options": "i"}},
        ])

    # Also resolve candidate's actual submission ID from DB if candidate_id is a synthetic selection ID
    try:
        cand_sub = db["candidate_submissions"].find_one({
            "$or": [
                {"id": candidate_id},
                {"candidate_id": candidate_id},
                {"candidate_email": {"$regex": f"^{re.escape(cand_email)}$", "$options": "i"}} if cand_email else {"id": candidate_id}
            ]
        })
        if cand_sub:
            real_sub_id = cand_sub.get("id") or cand_sub.get("submission_id")
            if real_sub_id:
                offer_data["submission_id"] = real_sub_id
                match_or.append({"submission_id": real_sub_id})
                match_or.append({"candidate_id": real_sub_id})
            if not cand_email and cand_sub.get("candidate_email"):
                cand_email = cand_sub["candidate_email"].strip().lower()
                offer_data["candidate_email"] = cand_email
            if not cand_name and cand_sub.get("candidate_name"):
                offer_data["candidate_name"] = cand_sub["candidate_name"]
    except Exception as e:
        logger.warning(f"Error resolving candidate submission for offer letter: {e}")

    try:
        db["offer_letters"].update_one(
            {"$or": match_or},
            {"$set": offer_data},
            upsert=True
        )
        
        # Also ensure candidate_submissions status is updated to Accepted
        if cand_email or candidate_id:
            sub_filter = []
            if cand_email:
                sub_filter.append({"candidate_email": {"$regex": f"^{re.escape(cand_email)}$", "$options": "i"}})
            if candidate_id:
                sub_filter.extend([{"id": candidate_id}, {"candidate_id": candidate_id}])
            if raw_id:
                sub_filter.extend([{"id": raw_id}, {"candidate_id": raw_id}])
            db["candidate_submissions"].update_many(
                {"$or": sub_filter},
                {"$set": {"status": "Accepted", "offer_status": "Offer Extended", "updated_at": now_iso}}
            )
    except Exception as e:
        logger.error(f"Failed to persist offer letter: {e}")
        return {"status": "error", "detail": str(e)}

    return {"status": "success", "message": "Offer letter saved successfully.", "offer": offer_data}


@app.post("/api/candidates/{candidate_id}/offer-letter/send")
@app.post("/candidates/{candidate_id}/offer-letter/send")
def send_candidate_offer_letter_endpoint(
    candidate_id: str,
    payload: dict | None = None,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Formally dispatch offer letter to candidate and update hiring pipeline."""
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only TermJobs Super Admin can issue candidate contracts")
    from datetime import datetime, timezone
    import re
    from modules.shared.db import db
    now_iso = datetime.now(timezone.utc).isoformat()
    raw_id = candidate_id.replace("CND-", "").replace("BEAR-", "").strip()

    target_email = ""
    target_name = ""
    try:
        existing = db["offer_letters"].find_one({
            "$or": [
                {"candidate_id": candidate_id},
                {"submission_id": candidate_id},
                {"candidate_id": raw_id},
                {"submission_id": raw_id},
            ]
        })
        if existing:
            target_email = (existing.get("candidate_email") or "").strip().lower()
            target_name = existing.get("candidate_name") or ""
        else:
            sub = db["candidate_submissions"].find_one({
                "$or": [
                    {"id": candidate_id},
                    {"candidate_id": candidate_id},
                    {"id": raw_id},
                    {"candidate_id": raw_id},
                ]
            })
            if sub:
                target_email = (sub.get("candidate_email") or "").strip().lower()
                target_name = sub.get("candidate_name") or ""
    except Exception as e:
        logger.warning(f"Error checking candidate for send: {e}")

    match_or = [
        {"candidate_id": candidate_id},
        {"submission_id": candidate_id},
    ]
    if raw_id:
        match_or.extend([{"candidate_id": raw_id}, {"submission_id": raw_id}])
    if target_email:
        match_or.extend([
            {"candidate_email": target_email},
            {"candidate_email": {"$regex": f"^{re.escape(target_email)}$", "$options": "i"}},
            {"email": {"$regex": f"^{re.escape(target_email)}$", "$options": "i"}},
        ])

    try:
        db["offer_letters"].update_many(
            {"$or": match_or},
            {"$set": {
                "status": "Offer Extended",
                "agreement_status": "Pending Signature",
                "sent_at": now_iso,
                "sent_by_role": current_user.role,
                "sent_by_id": str(current_user.id),
                "sent_by": getattr(current_user, "name", None) or getattr(current_user, "email", None) or "HR"
            }}
        )

        sub_or = [{"id": candidate_id}, {"candidate_id": candidate_id}]
        if raw_id:
            sub_or.extend([{"id": raw_id}, {"candidate_id": raw_id}])
        if target_email:
            sub_or.append({"candidate_email": {"$regex": f"^{re.escape(target_email)}$", "$options": "i"}})
        db["candidate_submissions"].update_many(
            {"$or": sub_or},
            {"$set": {
                "status": "Accepted",
                "offer_status": "Offer Extended",
                "offer_extended_at": now_iso,
                "updated_at": now_iso,
            }}
        )

        db["candidate_selections"].update_many(
            {"$or": sub_or},
            {"$set": {"status": "Accepted", "offer_status": "Offer Extended", "updated_at": now_iso}}
        )

        db["notifications"].insert_one({
            "type": "OFFER_LETTER_SENT",
            "candidate_id": candidate_id,
            "candidate_email": target_email,
            "actor": getattr(current_user, "name", None) or getattr(current_user, "email", None) or "HR",
            "title": "Formal Offer Letter Dispatched",
            "message": f"Employment offer letter has been dispatched to {target_name or candidate_id}.",
            "created_at": now_iso,
            "read": False
        })
    except Exception as e:
        logger.error(f"Failed to send offer letter: {e}")
        return {"status": "error", "detail": str(e)}

    return {"status": "success", "message": "Offer letter formally sent to candidate!"}




@app.post("/requisitions/{requisition_id}/close")
@app.post("/api/requisitions/{requisition_id}/close")
def close_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    req = service.close(requisition_id)
    _cache.clear()
    return _requisition_dict(req.id)


@app.post("/requisitions/{requisition_id}/reset")
@app.post("/api/requisitions/{requisition_id}/reset")
def reset_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    req = service.reset(requisition_id)
    _cache.clear()
    return _requisition_dict(req.id)


@app.delete("/requisitions/{requisition_id}", status_code=204)
@app.delete("/api/requisitions/{requisition_id}", status_code=204)
def delete_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> None:
    _require_writable(current_user)
    req = _get_requisition(requisition_id)
    _require_tenant(req, current_user)

    was_director_approved = bool(getattr(req, "director_approved", False)) or req.status in ("Published", "Approved")
    if was_director_approved and current_user.role not in (
        "Company Admin", "Admin", "Super Admin", "Director",
    ):
        raise HTTPException(
            status_code=403,
            detail="Approved or published requisitions must be deleted by a company administrator or Company Director.",
        )
    hm_name = current_user.name or current_user.email or "Hiring Manager"
    req_title = req.title or "Untitled Requisition"
    tenant_id = str(req.tenant_id or current_user.tenant_id or "local")
    now_iso = _utcnow().isoformat()

    if was_director_approved:
        try:
            from modules.notifications.services.notification_service import notify_requisition_deleted_by_hm
            notify_requisition_deleted_by_hm(
                requisition_id=str(req.id),
                requisition_title=req_title,
                tenant_id=tenant_id,
                deleted_by_name=hm_name,
                deleted_by_role=current_user.role,
                deleted_by_email=current_user.email or "",
                previous_status=req.status or "Published",
                director_approved_by=getattr(req, "director_approved_by", None) or "Director",
            )
        except Exception as notif_err:
            logger.warning(f"Failed to send delete notification: {notif_err}")

    try:
        from modules.shared.db import db
        s_role = getattr(req, "structured_role", {}) or {}
        if not isinstance(s_role, dict):
            s_role = getattr(s_role, "__dict__", {}) or {}

        approved_at_val = getattr(req, "director_approved_at", None)
        if approved_at_val and hasattr(approved_at_val, "isoformat"):
            approved_at_iso = approved_at_val.isoformat()
        else:
            approved_at_iso = _format_datetime(approved_at_val)

        created_at_val = getattr(req, "created_at", None)
        if created_at_val and hasattr(created_at_val, "isoformat"):
            created_at_iso = created_at_val.isoformat()
        else:
            created_at_iso = _format_datetime(created_at_val) or now_iso

        db["deleted_requisitions"].insert_one({
            "id": str(req.id),
            "title": req_title,
            "status": "Deleted by HM" if current_user.role == "Hiring Manager" else "Deleted",
            "original_status": req.status,
            "director_approved": was_director_approved,
            "director_approved_by": getattr(req, "director_approved_by", None) or ("Director" if was_director_approved else None),
            "director_approved_at": approved_at_iso,
            "created_by": str(getattr(req, "created_by", "") or current_user.id),
            "deleted_by": hm_name,
            "deleted_by_role": current_user.role,
            "deleted_by_email": current_user.email,
            "deleted_at": now_iso,
            "tenant_id": tenant_id,
            "company_profile_id": str(req.company_profile_id or ""),
            "department": getattr(req, "department", None) or s_role.get("department", "General"),
            "structured_role": s_role,
            "created_at": created_at_iso,
            "is_deleted": True,
        })
    except Exception as e:
        logger.warning(f"Failed to record deleted_requisition in MongoDB: {e}")
        raise HTTPException(
            status_code=503,
            detail="Deletion history could not be saved. The requisition has not been deleted. Please try again.",
        ) from e

    service.delete(requisition_id)
    _cache.clear()


# --- file upload for JD documents ---------------------------------------------
@app.post("/upload/jd-document")
async def upload_jd_document(file: UploadFile = File(...), current_user: User = Depends(get_current_user)) -> dict:
    """Upload a JD/spec document (.docx, .pdf) and extract text content + structured fields."""
    _require_writable(current_user)
    
    # Validate file type
    allowed_types = {
        'application/pdf': '.pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/msword': '.doc',
        'text/plain': '.txt',
        'text/markdown': '.md',
    }
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
    
    # Read file content
    content = await file.read()
    
    # Extract text based on file type
    if file.content_type == 'application/pdf':
        text = _extract_pdf_text(content)
    elif file.content_type in ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'):
        text = _extract_docx_text(content)
    else:
        text = content.decode('utf-8', errors='ignore')
    
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from document")
    
    # Extract structured fields for prefill
    extracted_fields = _extract_structured_fields(text.strip())
    
    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "extracted_text": text.strip(),
        "extracted_fields": extracted_fields,
        "size": len(content)
    }


def _extract_structured_fields(text: str) -> dict:
    """Extract structured fields from JD text for form prefill."""
    from modules.requisition.enrichment.heuristics import extract_from_text
    from modules.requisition.enrichment import skills as skills_module
    
    extracted = extract_from_text(text)
    skill_list = skills_module.skills_in_text(text)
    
    fields = {}
    
    # Title - extract just the role title
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    title_line = None
    
    # First, try to find a title-like line in the first few lines
    for line in lines[:5]:
        if len(line) < 80:
            lower = line.lower()
            if any(kw in lower for kw in ['engineer', 'developer', 'manager', 'analyst', 'architect', 'lead', 'senior', 'junior', 'principal', 'director', 'head', 'vp', 'cto', 'cfo', 'ceo']):
                title_line = line
                break
    
    # If no title found in lines, try to extract from single-line document
    if not title_line and len(lines) == 1:
        # For single-line documents, try to extract just the role title part
        line = lines[0]
        # Look for patterns like "Senior DevOps Engineer needed" or "Senior DevOps Engineer -"
        import re
        title_match = re.search(r'^(Senior|Junior|Lead|Principal|Staff)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:Engineer|Developer|Manager|Analyst|Architect|Lead|Director|Head)', line)
        if title_match:
            title_line = title_match.group(0).strip()
        else:
            # Try to find just the role title before common separators
            for sep in [' needed', ' required', ' wanted', ' - ', ' | ', ':', ';']:
                if sep in line:
                    potential = line.split(sep)[0].strip()
                    if len(potential) < 80 and any(kw in potential.lower() for kw in ['engineer', 'developer', 'manager', 'analyst', 'architect', 'lead', 'senior', 'junior', 'principal', 'director', 'head']):
                        title_line = potential
                        break
    
    if not title_line and lines:
        # Fallback: use first short line
        for line in lines[:3]:
            if len(line) < 80:
                title_line = line
                break
    
    if title_line:
        fields['job_title'] = title_line
    
    # Skills
    if skill_list:
        fields['must_have_skills'] = skill_list
    
    # Experience
    if extracted.get('years'):
        fields['experience'] = f"{extracted['years']} years"
    
    # Seniority
    if extracted.get('seniority'):
        fields['seniority'] = extracted['seniority'].value
    
    # Location
    if extracted.get('location'):
        fields['work_locations'] = [extracted['location']]
    
    # Rate band
    if extracted.get('rate_band'):
        fields['range_vendors_see_min'] = extracted['rate_band'][0]
        fields['range_vendors_see_max'] = extracted['rate_band'][1]
    
    # Contract duration
    if extracted.get('contract_duration'):
        fields['duration'] = extracted['contract_duration']
    
    return fields


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes with resilient multi-library fallback."""
    try:
        # 1. Prefer pymupdf / fitz if available (fastest and most accurate)
        try:
            import fitz  # type: ignore
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text = "\n".join(str(page.get_text() or "") for page in doc)
            if text.strip():
                return text
        except (ImportError, Exception):
            pass

        # 2. Try pypdf dynamically
        try:
            pypdf = __import__("pypdf")
            import io
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            text = "\n".join(str(page.extract_text() or "") for page in reader.pages)
            if text.strip():
                return text
        except (ImportError, Exception):
            pass

        # 3. Try pdfplumber dynamically
        try:
            pdfplumber = __import__("pdfplumber")
            import io
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                return "\n".join(str(page.extract_text() or "") for page in pdf.pages)
        except (ImportError, Exception):
            pass

        return ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {e}")


def _extract_docx_text(docx_bytes: bytes) -> str:
    """Extract text from DOCX bytes."""
    try:
        from docx import Document
        import io
        doc = Document(io.BytesIO(docx_bytes))
        return "\n".join([para.text for para in doc.paragraphs])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOCX parsing failed: {e}")


# --- static UI / health ------------------------------------------------------
@app.get("/", include_in_schema=False)
def index(request: Request) -> Any:
    p = str(request.url)
    if "/health" in p:
        return health()
    if (Path(__file__).parent / "index.html").exists():
        return FileResponse(Path(__file__).parent / "index.html")
    return {"status": "online"}


@app.get("/api/index.py", include_in_schema=False)
@app.get("/api/ping", include_in_schema=False)
@app.get("/ping", include_in_schema=False)
def health() -> dict:
    from modules.shared.db import db

    try:
        db.command("ping")
        db_status = "ok"
    except Exception:  # noqa: BLE001
        db_status = "degraded"
    return {"status": "ok", "llm_provider": os.getenv("LLM_PROVIDER", "groq"), "db": db_status}

# reload
