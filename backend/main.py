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

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse

from pydantic import BaseModel, Field

from modules.candidate.router import router as candidate_router
from modules.identity.domain.models import User, VendorEngagement, Tenant
from modules.identity.router import get_current_user

from modules.calendar.router import router as calendar_router
from modules.identity.router import router as identity_router
from modules.notifications.router import router as notifications_router
from modules.notifications.services.notification_service import notify_requisition_published
from modules.requisition.domain import models, schemas
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
from modules.hiring_manager_agent.router import router as hiring_manager_agent_router
from modules.billing.router import router as vendor_billing_router
from modules.superadmin_agent.voice_router import router as voice_router
from modules.onboarding.offboarding_router import router as offboarding_router
from modules.candidate_profile.router import router as candidate_profile_router


app = FastAPI(
    title="TermJobs Requisition API",
    description="Intake and structure job requisitions using AI agents.",
    
    version="1.0.0",
)


@app.exception_handler(404)
async def custom_404_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Route Not Found",
            "requested_url": str(request.url),
            "scope_path": request.scope.get("path"),
            "scope_root_path": request.scope.get("root_path"),
            "scope_raw_path": str(request.scope.get("raw_path")),
            "query_params": dict(request.query_params),
            "headers": dict(request.headers),
        }
    )

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

# --- Global Exception Handlers with CORS Preservation & Debug Logging ---
import traceback
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f" [UNHANDLED BACKEND SERVER ERROR] {request.method} {request.url.path}: {exc}"
    print(error_msg, file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal Server Error: {str(exc)}",
            "type": type(exc).__name__,
            "path": request.url.path,
        },
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    print(f" [HTTP EXCEPTION {exc.status_code}] {request.method} {request.url.path}: {exc.detail}", file=sys.stderr)
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )

@app.get("/health")
@app.get("/api/health")
def health_check():
    """Health check endpoint providing MongoDB connectivity and server diagnostics."""
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
        "database_error": db_error,
        "environment": os.getenv("VERCEL_ENV", "local"),
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
app.include_router(hiring_manager_agent_router)
app.include_router(vendor_billing_router)
app.include_router(voice_router)
app.include_router(offboarding_router, tags=["Offboarding"])
app.include_router(candidate_profile_router)

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
try:
    init_db()
    try:
        from scripts.seed_super_admin import seed_super_admin
        seed_super_admin()
    except Exception as s_exc:
        import logging
        logging.getLogger("uvicorn.error").warning("seed_super_admin error: %s", s_exc)
except Exception as exc:  # noqa: BLE001
    # Do not hard-crash at startup if MongoDB is unreachable (e.g. Atlas
    # paused / IP allowlist changed). The server boots and reports degraded
    # status via /health so callers can diagnose instead of a blank port.
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
    company_profile_id: str
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


class AnswerIn(BaseModel):
    answer: str


class RefineIn(BaseModel):
    instruction: str


class ApproveIn(BaseModel):
    reviewer: str | None = None
    edited_role: dict | None = None


class RejectIn(BaseModel):
    reviewer: str | None = None
    reason: str | None = None


class ApproveByIn(BaseModel):
    by: str | None = None


class CandidateLimitIn(BaseModel):
    limit: int = Field(ge=1, le=100)


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
        return val.isoformat()
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
        sr = dict(req.structured_role or {})
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

        return {
            "id": req.id,
            "ref": f"REQ-{req.id[:6].upper()}",
            "tenant_id": req.tenant_id,
            "company_profile_id": req.company_profile_id,
            "company": company,
            "status": req.status,
            "title": req.title,
            "intent": req.intent,
            "intake_answers": req.intake_answers,
            "pending_question": req.pending_question,
            "structured_role": sr,
            "vendor_candidate_limit": v_limit,
            "published_vendors": published_vendors,
            "hiring_manager_name": sr.get("hiring_manager") or "",
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
    if current_user.role == "Director":
        raise HTTPException(
            status_code=403,
            detail="Directors have read-only access",
        )


_auto_close_last_run: float = 0.0  # module-level debounce


def _auto_close_expired() -> None:
    """Auto-close Published requisitions whose submission deadline has passed.

    Debounced: runs at most once per 5 minutes to avoid repeated DB scans.
    """
    global _auto_close_last_run
    import time as _time
    import datetime as _dt

    now = _time.time()
    if now - _auto_close_last_run < 300:  # 5 min debounce
        return
    _auto_close_last_run = now

    with get_session() as session:
        # Only query PUBLISHED requisitions (avoids full table scan)
        for req in session.query(models.Requisition).filter(
            models.Requisition.status == schemas.RequisitionStatus.PUBLISHED.value
        ).all():
            sr = req.structured_role or {}
            deadline = sr.get("submission_deadline")
            ends_on = sr.get("ends_on")
            today = _dt.date.today()
            should_close = False

            if deadline:
                try:
                    deadline_date = _dt.date.fromisoformat(str(deadline)[:10])
                    if deadline_date < today:
                        should_close = True
                except ValueError:
                    pass

            if not should_close and ends_on:
                try:
                    ends_on_date = _dt.date.fromisoformat(str(ends_on)[:10])
                    if ends_on_date < today:
                        should_close = True
                except ValueError:
                    pass

            if should_close:
                try:
                    sm = StateMachine(schemas.RequisitionStatus(req.status))
                    sm.transition(schemas.RequisitionStatus.CLOSED)
                    req.status = sm.status.value
                except Exception:
                    req.status = schemas.RequisitionStatus.CLOSED.value
                session.commit()
                try:
                    from modules.shared.db import db
                    db["requisitions"].update_one(
                        {"id": req.id},
                        {"$set": {"status": schemas.RequisitionStatus.CLOSED.value, "updated_at": _dt.datetime.now(_dt.timezone.utc).isoformat()}}
                    )
                except Exception:
                    pass
                req = None  # release for next iteration


def _auto_check_shortlists_48h() -> None:
    """Auto-dispatch 48h candidate shortlists for requisitions whose sourcing window has passed."""
    try:
        from modules.candidate.shortlist_service import auto_check_and_dispatch_48h_shortlists
        auto_check_and_dispatch_48h_shortlists()
    except Exception as e:
        pass



# --- company profile endpoints ----------------------------------------------
@app.post("/company-profiles", status_code=201)
def create_company_profile(body: CompanyProfileIn, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)

    with get_session() as session:
        prof = models.CompanyProfile(**body.model_dump(), tenant_id=current_user.tenant_id)
        session.add(prof)
        session.commit()
        session.refresh(prof)
        return {"id": prof.id, "name": prof.name, "tenant_id": prof.tenant_id}


@app.get("/company-profiles")
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


@app.post("/templates", status_code=201)
async def upload_template(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a JSON role template (director-defined) that hiring managers can
    use to pre-fill the New Requisition form.

    Accepts a single template or a ``{"templates": [...]}`` bundle. Each item
    may use the app's internal ``structured_role`` shape or the director's
    flat format with nested ``role`` / ``engagement`` / ``commercials`` /
    ``work_setup`` / ``compliance`` / ``process`` objects.
    """
    if file.content_type not in ("application/json", "text/json"):
        raise HTTPException(status_code=400, detail="Template must be a JSON file")
    content = await file.read()
    try:
        payload = json.loads(content.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Template file contains invalid JSON")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Template JSON must be an object")

    bundle = payload.get("templates")
    items = bundle if isinstance(bundle, list) else [payload]

    created = []
    with get_session() as session:
        for item in items:
            if not isinstance(item, dict):
                continue
            role, name, description = _template_role(item)
            title = (role or {}).get("title") or item.get("title") or item.get("name")
            if not title:
                continue
            tpl = models.RoleTemplate(
                tenant_id=current_user.tenant_id,
                created_by=current_user.id,
                name=name or f"Template  {title}",
                description=description or "",
                structured_role=role,
            )
            session.add(tpl)
            created.append(tpl)
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
        [c.strip() for c in str(certs_raw).split(",") if c.strip()]
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
def list_templates(current_user: User = Depends(get_current_user)) -> list[dict]:
    with get_session() as session:
        # Templates are shared platform config: Super Admin-created templates are
        # visible to everyone; company-scoped templates only to that tenant.
        super_admin_ids = {
            u.id
            for u in session.query(User).filter(User.role == "Super Admin").all()
        }
        rows = session.query(models.RoleTemplate).order_by(models.RoleTemplate.created_at.desc()).all()
        if current_user.role != "Super Admin":
            rows = [
                r
                for r in rows
                if r.tenant_id in (current_user.tenant_id, "local", "platform", None) or r.created_by in super_admin_ids or not r.created_by
            ]
        return [_template_dict(r) for r in rows]


@app.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: str, current_user: User = Depends(get_current_user)) -> None:
    with get_session() as session:
        tpl = session.get(models.RoleTemplate, template_id)
        if tpl is None:
            raise HTTPException(status_code=404, detail="template not found")
        if current_user.role != "Super Admin" and tpl.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="You do not have access to this template")
        session.delete(tpl)
        session.commit()


# --- requisition lifecycle --------------------------------------------------
@app.post("/requisitions", status_code=201)
def create_requisition(
    body: RequisitionIn,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user)
) -> dict:
    _require_writable(current_user)

    # The company profile must belong to the requester's tenant.
    with get_session() as session:
        prof = session.get(models.CompanyProfile, body.company_profile_id)
    if prof is None:
        raise HTTPException(status_code=404, detail="company profile not found")
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
        company_profile_id=body.company_profile_id,
        intent=intent,
        created_by=body.created_by or current_user.id,
        tenant_id=current_user.tenant_id,
        intake_meta={
            "intake_mode": body.intake_mode,
            "background_profile_id": body.background_profile_id,
            "reference_documents": body.reference_documents,
            "context_notes": body.context_notes,
            "source_filename": body.source_filename,
            "prefill": body.prefill or {},
        },
    )
    _cache.clear()
    background_tasks.add_task(_async_trigger_top_candidate_outreach, req.id)
    return _requisition_dict(req.id)


@app.get("/requisitions")
@app.get("/api/requisitions")
def list_requisitions(current_user: User = Depends(get_current_user)) -> list[dict]:
    from modules.identity.domain.models import VendorEngagement

    # Cache requisitions per user for 30s to avoid repeated DB scans
    _cache_key = f"reqs:{current_user.id}:{current_user.role}:{current_user.tenant_id}"
    _cached = _cache.get(_cache_key)
    if _cached is not None:
        return _cached

    _auto_close_expired()
    _auto_check_shortlists_48h()
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
        rows = query.all()
        # Only fetch company profiles referenced by the returned requisitions (not ALL profiles)
        needed_cp_ids = {r.company_profile_id for r in rows if r.company_profile_id}
        profiles = {}
        if needed_cp_ids:
            profiles = {p.id: p for p in session.query(models.CompanyProfile).filter(
                models.CompanyProfile.id.in_(list(needed_cp_ids))
            ).all()}
        is_vendor = current_user.role == "Recruiter"
        result = [
            {
                "id": r.id,
                "ref": f"REQ-{r.id[:6].upper()}",
                "tenant_id": r.tenant_id,
                "status": r.status,
                "title": r.title,
                "company_profile_id": r.company_profile_id,
                "company_name": profiles[r.company_profile_id].name
                if r.company_profile_id in profiles
                else None,
                "generated_jd_markdown": r.generated_jd_markdown,
                "structured_role": r.structured_role,
                "hiring_manager_name": (r.structured_role or {}).get("hiring_manager") or "",
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
        _cache.set(_cache_key, result, ttl=30)  # 30s cache
        return result


@app.get("/api/public/requisitions")
def list_public_requisitions() -> list[dict]:
    """Public endpoint listing all live published requisitions across all companies."""
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
            raise HTTPException(
                status_code=400,
                detail="No resume on file found for your profile. Please complete your profile and upload your resume first."
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
        "status": "Screened",
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

    return {
        "status": "success",
        "application_ref": sub_id,
        "candidate_name": name.strip(),
        "candidate_email": email.strip().lower(),
        "requisition_id": requisition_id,
        "requisition_title": req.title,
        "company_name": comp_name,
        "match_score": score,
        "recommendation": recommendation,
        "message": f"Thank you, {name}! Your application for '{req.title}' at {comp_name} has been successfully received.",
    }


@app.post("/api/public/candidate/register")
async def register_public_candidate(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    title: str = Form(""),
    linkedin_url: str = Form(""),
    github_url: str = Form(""),
    skills: str = Form(""),
    cover_note: str = Form(""),
    resume: UploadFile = File(...),
) -> dict:
    """Allow any prospective candidate to register their profile and resume to join the talent pool."""
    import tempfile
    from datetime import datetime, timezone
    from modules.candidate.extractor import extract_candidate_profile
    from modules.resume_screener.pipeline.extractor import extract_text as _extract_text_new
    from modules.shared.db import db

    content = await resume.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume file is empty.")

    filename = resume.filename or "resume.pdf"
    file_type = "docx" if filename.lower().endswith(".docx") else "pdf"
    pdf_base64 = base64.b64encode(content).decode("utf-8")

    extracted_text = ""
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
        "source": "Portal Registration",
        "created_at": now_utc,
        "updated_at": now_utc,
    }

    try:
        db["candidates"].insert_one(cand_doc)
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

    return {
        "status": "success",
        "candidate_id": cand_id,
        "message": f"Welcome, {name}! Your profile and resume have been successfully added to the TermJobs Talent Pool.",
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

    # 1. Fetch candidates from candidates bank
    bank_candidates = list(db["candidates"].find({}, {"resume_pdf": 0, "extracted_text": 0}).sort("created_at", -1))

    # 2. Fetch candidate submissions
    submissions = list(db["candidate_submissions"].find({}, {"resume_pdf": 0, "resume_text": 0}).sort("created_at", -1))

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
            "has_resume": True,
            "applications": [],
            "created_at": created_val.isoformat() if hasattr(created_val, "isoformat") else str(created_val or ""),
        }

    for s in submissions:
        sub_id = s.get("id") or str(s.get("_id"))
        email = (s.get("candidate_email") or "").strip().lower()
        cid = s.get("workorder_id") or s.get("candidate_id") or sub_id
        key = email if (email and email in cand_dict) else cid

        req_info = req_map.get(s.get("requisition_id"), {})
        created_val = s.get("created_at")
        app_entry = {
            "submission_id": sub_id,
            "requisition_id": s.get("requisition_id"),
            "requisition_title": req_info.get("title") or s.get("requisition_title") or "Open Role",
            "company_name": req_info.get("company") or s.get("company_name") or "Enterprise Partner",
            "match_score": float(s.get("match_score")) if s.get("match_score") is not None else None,
            "recommendation": s.get("recommendation"),
            "status": s.get("status") or "Screened",
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
                "has_resume": True,
                "applications": [app_entry] if s.get("requisition_id") else [],
                "created_at": created_val.isoformat() if hasattr(created_val, "isoformat") else str(created_val or ""),
            }

    all_candidates = list(cand_dict.values())

    # Calculate overall stats prior to search filtering
    total_count = len(all_candidates)
    portal_count = sum(1 for c in all_candidates if c["is_direct_applicant"])
    vendor_count = total_count - portal_count
    resumes_count = total_count

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
except Exception as bus_err:
    logger.warning(f"Could not bind requisition.published to outreach: {bus_err}")



@app.get("/api/public/outreach/{token}/respond", response_class=HTMLResponse)
def candidate_outreach_respond(request: Request, token: str, action: str = "interested"):
    """
    Public interactive response endpoint triggered when a candidate clicks
    [Available & Interested] or [Not Available] in their email or outreach.
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
        🎥 Your Video Interview Room is Ready
      </div>
      <div style="margin: 14px 0;">
        <a href="{meeting_link}" target="_blank" style="display: inline-block; background: #059669; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(5,150,105,0.25);">
          Enter Video Interview Room &rarr;
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
        sub_desc = "Your profile has been fast-tracked into the active interview screening pipeline. Your video room is provisioned above."
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

@app.on_event("startup")
async def on_app_startup():
    """Start background services on app launch."""
    try:
        from modules.candidate.telegram_service import start_telegram_polling
        start_telegram_polling()
        print("[APP STARTUP] Telegram Bot long-polling initialized successfully.")
    except Exception as exc:
        print(f"[APP STARTUP TELEGRAM ERROR] {exc}")

    # Launch 48-Hour Shortlist auto-dispatch background worker
    async def _shortlist_worker():
        while True:
            try:
                await asyncio.sleep(60)
                from modules.candidate.shortlist_service import auto_check_and_dispatch_48h_shortlists
                auto_check_and_dispatch_48h_shortlists()
            except asyncio.CancelledError:
                break
            except Exception:
                pass
    asyncio.create_task(_shortlist_worker())



@app.on_event("shutdown")
async def on_app_shutdown():
    """Cleanly tear down background tasks."""
    try:
        from modules.candidate.telegram_service import stop_telegram_polling
        stop_telegram_polling()
    except Exception:
        pass


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
    _auto_check_shortlists_48h()
    req = _get_requisition(requisition_id)
    _require_tenant(req, current_user)
    is_vendor = current_user.role == "Recruiter"
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


@app.post("/requisitions/{requisition_id}/approve")
@app.post("/api/requisitions/{requisition_id}/approve")
def approve_requisition(requisition_id: str, body: ApproveIn | None = None, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
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
                db_req.director_approved = True
                db_req.director_approved_by = current_user.name or current_user.email or "Director"
                db_req.director_approved_at = _utcnow()
            else:
                db_req.director_approved = False
                db_req.director_approved_by = None
                db_req.director_approved_at = None
            session.commit()

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

    with get_session() as session:
        db_req = session.get(models.Requisition, requisition_id)
        if db_req:
            db_req.status = schemas.RequisitionStatus.PUBLISHED.value
            db_req.director_approved = True
            db_req.director_approved_by = current_user.name or current_user.email or "Director"
            db_req.director_approved_at = _utcnow()
            db_req.rejection_reason = None
            db_req.rejected_by = None
            db_req.rejected_at = None
            session.commit()

    try:
        service.publish(requisition_id, by=current_user.name or current_user.email or "Director")
    except Exception:
        pass

    # Sync to MongoDB and clear cache
    try:
        from modules.shared.db import db
        now_iso = _utcnow().isoformat()
        db["requisitions"].update_one(
            {"id": requisition_id},
            {"$set": {
                "status": schemas.RequisitionStatus.PUBLISHED.value,
                "director_approved": True,
                "director_approved_by": current_user.name or current_user.email or "Director",
                "director_approved_at": now_iso,
                "rejection_reason": None,
                "rejected_by": None,
                "rejected_at": None,
                "updated_at": now_iso,
            }}
        )
    except Exception:
        pass

    try:
        notify_requisition_published(requisition_id)
    except Exception:
        pass

    _cache.clear()
    background_tasks.add_task(_async_trigger_top_candidate_outreach, requisition_id)
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/reject")
@app.post("/api/requisitions/{requisition_id}/reject")
def reject_requisition(requisition_id: str, body: RejectIn | None = None, current_user: User = Depends(get_current_user)) -> dict:
    _require_tenant(_get_requisition(requisition_id), current_user)

    reviewer = (body.reviewer if body else None) or current_user.name or current_user.email or "Director"
    reason = (body.reason if body and body.reason else None) or "Revision requested by Director"

    with get_session() as session:
        db_req = session.get(models.Requisition, requisition_id)
        if db_req:
            db_req.status = schemas.RequisitionStatus.STRUCTURING.value
            db_req.director_approved = False
            db_req.director_approved_by = None
            db_req.director_approved_at = None
            db_req.rejection_reason = reason
            db_req.rejected_by = reviewer
            db_req.rejected_at = _utcnow()
            session.commit()

    try:
        service.reject(requisition_id, reviewer=reviewer)
    except Exception:
        pass

    # Sync to MongoDB and clear cache
    try:
        from modules.shared.db import db
        now_iso = _utcnow().isoformat()
        db["requisitions"].update_one(
            {"id": requisition_id},
            {"$set": {
                "status": schemas.RequisitionStatus.STRUCTURING.value,
                "director_approved": False,
                "director_approved_by": None,
                "director_approved_at": None,
                "rejection_reason": reason,
                "rejected_by": reviewer,
                "rejected_at": now_iso,
                "updated_at": now_iso,
            }}
        )
    except Exception:
        pass

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
    _require_tenant(_get_requisition(requisition_id), current_user)

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
                s_req.director_approved = True
                s_req.director_approved_by = current_user.name or current_user.email or "Director"
                s_req.director_approved_at = _utcnow()
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
            }}
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
    from modules.candidate.shortlist_service import get_requisition_shortlist_status
    return get_requisition_shortlist_status(requisition_id)


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



@app.post("/requisitions/{requisition_id}/close")
def close_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    req = service.close(requisition_id)
    _cache.clear()
    return _requisition_dict(req.id)


@app.post("/requisitions/{requisition_id}/reset")
def reset_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    req = service.reset(requisition_id)
    _cache.clear()
    return _requisition_dict(req.id)


@app.delete("/requisitions/{requisition_id}", status_code=204)
def delete_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> None:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
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
    """Extract text from PDF bytes."""
    try:
        from pypdf import PdfReader
        import io
        reader = PdfReader(io.BytesIO(pdf_bytes))
        extracted_text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return extracted_text
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


@app.get("/health")
@app.get("/api/health")
def health() -> dict:
    from modules.shared.db import db

    try:
        db.command("ping")
        db_status = "ok"
    except Exception:  # noqa: BLE001
        db_status = "degraded"
    return {"status": "ok", "llm_provider": os.getenv("LLM_PROVIDER", "groq"), "db": db_status}
