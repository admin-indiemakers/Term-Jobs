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

import os
import sys
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from pydantic import BaseModel, Field

from modules.candidate.router import router as candidate_router
from modules.identity.domain.models import User
from modules.identity.router import get_current_user

from modules.identity.router import router as identity_router
from modules.requisition.domain import models, schemas
from modules.shared.db import get_session, init_db

# The screening agent package uses top-level `services.*` imports, so its
# directory must be importable (same layout as its standalone main.py).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "modules", "candidate_screening_agent"))
from modules.candidate_screening_agent.routers.screening import router as screening_router

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

app.include_router(identity_router)
app.include_router(candidate_router)
app.include_router(screening_router, prefix="/api", tags=["Screening"])



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


def _requisition_dict(requisition_id: str) -> dict:
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


# --- company profile endpoints ----------------------------------------------
@app.post("/company-profiles", status_code=201)
def create_company_profile(body: CompanyProfileIn, current_user: User = Depends(get_current_user)) -> dict:

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


# --- requisition lifecycle --------------------------------------------------
@app.post("/requisitions", status_code=201)
def create_requisition(body: RequisitionIn, current_user: User = Depends(get_current_user)) -> dict:
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
    )
    return _requisition_dict(req.id)


@app.get("/requisitions")
def list_requisitions(current_user: User = Depends(get_current_user)) -> list[dict]:
    from modules.identity.domain.models import VendorEngagement

    with get_session() as session:
        query = session.query(models.Requisition).order_by(models.Requisition.created_at.desc())
        if current_user.role == "Super Admin":
            pass
        elif current_user.role == "Recruiter":
            # Vendors only see requisitions from companies that engaged them.
            engaged_company_ids = {
                e.tenant_id
                for e in session.query(VendorEngagement)
                .filter(VendorEngagement.vendor_tenant_id == current_user.tenant_id)
                .all()
            }
            query = query.filter(models.Requisition.tenant_id.in_(engaged_company_ids or {""}))
        else:
            query = query.filter(models.Requisition.tenant_id == current_user.tenant_id)
        rows = query.all()
        profiles = {p.id: p for p in session.query(models.CompanyProfile).all()}
        return [
            {
                "id": r.id,
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
    _require_tenant(_get_requisition(requisition_id), current_user)
    return _requisition_dict(requisition_id)


@app.post("/requisitions/{requisition_id}/start")
def start_requisition_flow(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_tenant(_get_requisition(requisition_id), current_user)
    state, interrupt = service.start_intake(requisition_id)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/answer")
def answer_intake_question(requisition_id: str, body: AnswerIn, current_user: User = Depends(get_current_user)) -> dict:
    _require_tenant(_get_requisition(requisition_id), current_user)
    state, interrupt = service.answer(requisition_id, body.answer)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/refine")
def refine_requisition_jd(requisition_id: str, body: RefineIn, current_user: User = Depends(get_current_user)) -> dict:
    _require_tenant(_get_requisition(requisition_id), current_user)
    try:
        state, interrupt = service.refine(requisition_id, body.instruction)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/approve")
def approve_requisition(requisition_id: str, body: ApproveIn | None = None, current_user: User = Depends(get_current_user)) -> dict:
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
    _require_tenant(_get_requisition(requisition_id), current_user)

    reviewer = body.reviewer if body else None
    state, interrupt = service.reject(requisition_id, reviewer=reviewer)
    return _interrupt_payload(state, interrupt)


@app.post("/requisitions/{requisition_id}/publish")
def publish_requisition(requisition_id: str, body: ApproveByIn | None = None, current_user: User = Depends(get_current_user)) -> dict:
    _require_tenant(_get_requisition(requisition_id), current_user)

    by = body.by if body else None
    req = service.publish(requisition_id, by=by)
    return _requisition_dict(req.id)


@app.post("/requisitions/{requisition_id}/close")
def close_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_tenant(_get_requisition(requisition_id), current_user)
    req = service.close(requisition_id)
    return _requisition_dict(req.id)


@app.post("/requisitions/{requisition_id}/reset")
def reset_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> dict:
    _require_tenant(_get_requisition(requisition_id), current_user)
    req = service.reset(requisition_id)
    return _requisition_dict(req.id)


@app.delete("/requisitions/{requisition_id}", status_code=204)
def delete_requisition(requisition_id: str, current_user: User = Depends(get_current_user)) -> None:
    _require_tenant(_get_requisition(requisition_id), current_user)
    service.delete(requisition_id)


# --- static UI / health ------------------------------------------------------
@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(Path(__file__).parent / "index.html")


@app.get("/health")
def health() -> dict:
    from modules.shared.db import db

    try:
        db.command("ping")
        db_status = "ok"
    except Exception:  # noqa: BLE001
        db_status = "degraded"
    return {"status": "ok", "llm_provider": os.getenv("LLM_PROVIDER", "groq"), "db": db_status}
