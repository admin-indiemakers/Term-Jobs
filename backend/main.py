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
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from pydantic import BaseModel, Field

from modules.candidate.router import router as candidate_router
from modules.identity.domain.models import User
from modules.identity.router import get_current_user

from modules.calendar.router import router as calendar_router
from modules.identity.router import router as identity_router
from modules.notifications.router import router as notifications_router
from modules.notifications.services.notification_service import notify_requisition_published
from modules.requisition.domain import models, schemas
from modules.shared.db import get_session, init_db
from modules.resume_screener.router import router as resume_screener_router
from modules.interview.router import router as interview_router


app = FastAPI(
    title="TermJobs Requisition API",
    description="Intake and structure job requisitions using AI agents.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def vercel_routing_middleware(request: Request, call_next):
    # Support Vercel serverless rewritten paths via query param or headers
    target = request.query_params.get("__vercel_path")
    if not target:
        for header_key in ("x-matched-path", "x-forwarded-uri", "x-invoke-path"):
            val = request.headers.get(header_key)
            if val and val not in ("/api", "/api/", "/api/index", "/api/index.py"):
                target = val
                break

    if target:
        if target.startswith("//"):
            target = "/" + target.lstrip("/")
        if "?" in target:
            target = target.split("?")[0]
        request.scope["path"] = target

    return await call_next(request)

app.include_router(identity_router, prefix="/api/auth")
app.include_router(candidate_router)
app.include_router(candidate_router, prefix="/api")
app.include_router(calendar_router, prefix="/api", tags=["Calendar"])
app.include_router(resume_screener_router, prefix="/api", tags=["Resume Screener"])
app.include_router(interview_router, prefix="/api", tags=["Interviews"])
app.include_router(notifications_router)



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


def _strip_internal_role(role: Any) -> Any:
    """Remove internal-only commercial fields before a vendor sees a role.

    ``ceiling_internal`` must never reach a vendor-facing response; only
    ``range_vendors_see`` is published to consultancies.
    """
    if not isinstance(role, dict):
        return role
    return {k: v for k, v in role.items() if k not in INTERNAL_ROLE_KEYS}


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
            "structured_role": req.structured_role,
            "generated_jd_markdown": req.generated_jd_markdown,
            "coverage_result": req.coverage_result,
            "refinement_log": req.refinement_log or [],
            "intake_meta": req.intake_meta or {},
            "approved_by": req.approved_by,
            "approved_at": req.approved_at.isoformat() if req.approved_at else None,
            "created_at": req.created_at.isoformat() if req.created_at else None,
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


def _auto_close_expired() -> None:
    """Auto-close Published requisitions whose submission deadline has passed.

    Lazily swept on every list/detail read so vendors stop seeing expired roles
    without a background scheduler. Safe to run repeatedly â€” idempotent.
    """
    import datetime as _dt

    from modules.requisition.domain.state import StateMachine

    with get_session() as session:
        for req in session.query(models.Requisition).all():
            if req.status != schemas.RequisitionStatus.PUBLISHED.value:
                continue
            deadline = (req.structured_role or {}).get("submission_deadline")
            if not deadline:
                continue
            try:
                deadline_date = _dt.date.fromisoformat(str(deadline))
            except ValueError:
                continue
            if deadline_date <= _dt.date.today():
                sm = StateMachine(schemas.RequisitionStatus(req.status))
                sm.transition(schemas.RequisitionStatus.CLOSED)
                req.status = sm.status.value
                session.commit()
                req = None  # release for next iteration


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
        "created_at": t.created_at.isoformat() if t.created_at else None,
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
                name=name or f"Template â€” {title}",
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
                if r.tenant_id == current_user.tenant_id or r.created_by in super_admin_ids
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
def create_requisition(body: RequisitionIn, current_user: User = Depends(get_current_user)) -> dict:
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
    return _requisition_dict(req.id)


@app.get("/requisitions")
def list_requisitions(current_user: User = Depends(get_current_user)) -> list[dict]:
    from modules.identity.domain.models import VendorEngagement

    _auto_close_expired()
    with get_session() as session:
        query = session.query(models.Requisition).order_by(models.Requisition.created_at.desc())
        if current_user.role == "Super Admin":
            pass
        elif current_user.role == "Recruiter":
            # Vendors only see requisitions from companies that engaged them,
            # and only published requisitions â€” never drafts or in-progress ones.
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
        else:
            query = query.filter(models.Requisition.tenant_id == current_user.tenant_id)
        rows = query.all()
        profiles = {p.id: p for p in session.query(models.CompanyProfile).all()}
        is_vendor = current_user.role == "Recruiter"
        return [
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
                "intent": r.intent,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


@app.get("/requisitions/{requisition_id}")
def get_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _auto_close_expired()
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
    state, interrupt = service.approve(requisition_id, reviewer=reviewer, edited_role=edited)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/reject")
def reject_requisition(requisition_id: str, body: RejectIn | None = None, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)

    reviewer = body.reviewer if body else None
    state, interrupt = service.reject(requisition_id, reviewer=reviewer)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/publish")
def publish_requisition(requisition_id: str, body: ApproveByIn | None = None, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)

    by = body.by if body else None
    try:
        req = service.publish(requisition_id, by=by)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    try:
        notify_requisition_published(requisition_id)
    except Exception:  # noqa: BLE001
        pass
    return _requisition_dict(req.id)


@app.post("/requisitions/{requisition_id}/close")
def close_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    req = service.close(requisition_id)
    return _requisition_dict(req.id)


@app.post("/requisitions/{requisition_id}/reset")
def reset_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    req = service.reset(requisition_id)
    return _requisition_dict(req.id)


@app.delete("/requisitions/{requisition_id}", status_code=204)
def delete_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> None:
    _require_writable(current_user)
    _require_tenant(_get_requisition(requisition_id), current_user)
    service.delete(requisition_id)


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
        import fitz
        extracted_text = ""
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page in doc:
                extracted_text += page.get_text("text")
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
@app.get("/api", include_in_schema=False)
def index(request: Request) -> Any:
    # If the requested path or query was for health/docs
    p = str(request.url)
    if "/health" in p:
        return health()
    return FileResponse(Path(__file__).parent / "index.html")


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
